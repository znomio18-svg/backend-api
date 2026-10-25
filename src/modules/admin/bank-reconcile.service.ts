import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { parseStatement, StatementFormatError, StatementRow } from './statement-parser';

export type RowStatus =
  /** Our reference is in the description and the amount covers the payment */
  | 'MATCHED'
  /** Reference found but less money arrived than was owed */
  | 'AMOUNT_LOW'
  /** Reference found but the payment is already confirmed */
  | 'ALREADY_PAID'
  /** Reference found but the payment was rejected/failed/refunded */
  | 'NOT_CONFIRMABLE'
  /** A second statement line carrying the same reference */
  | 'DUPLICATE'
  /** No reference of ours in the description */
  | 'NO_REFERENCE';

/** Only bank transfers this recent are considered. */
const LOOKBACK_DAYS = 180;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_CONFIRM = 2000;
const CONFIRM_CONCURRENCY = 4;

/** "sk m1ab-cdef" → "SKM1ABCDEF": users type the code with spaces, dashes, lower case. */
function normalize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Confirms bank transfers from an uploaded bank statement instead of one by
 * one (ported from FMDrama). Every bank transfer payment carries a unique
 * reference (`SK…`) the payer puts in the transfer description; a statement
 * credit line containing that reference with enough money is proof of payment.
 *
 * `preview` only reports what matches; `confirm` confirms the payment ids the
 * admin approved, re-checking each one.
 */
@Injectable()
export class BankReconcileService {
  private readonly logger = new Logger(BankReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async previewFile(filename: string, contentBase64: string) {
    const base64 = contentBase64.replace(/^data:[^,]*;base64,/, '').replace(/\s+/g, '');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) throw new BadRequestException('Файл хоосон байна');
    if (buffer.length > MAX_FILE_BYTES) throw new BadRequestException('Файл хэт том байна (10MB-аас ихгүй)');

    let parsed;
    try {
      parsed = await parseStatement(filename, buffer);
    } catch (error) {
      if (error instanceof StatementFormatError) throw new BadRequestException(error.message);
      throw new BadRequestException('Хуулгын файлыг уншиж чадсангүй');
    }
    if (parsed.rows.length > MAX_ROWS) {
      throw new BadRequestException(`Хуулга хэт том байна (${MAX_ROWS} орлогын мөрөөс ихгүй)`);
    }

    const matched = await this.match(parsed.rows);
    return {
      columns: parsed.columns,
      creditLines: parsed.rows.length,
      totalLines: parsed.totalLines,
      ...matched,
    };
  }

  private async match(rows: StatementRow[]) {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000);
    const transfers = await this.prisma.payment.findMany({
      where: {
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transferRef: { not: null },
        createdAt: { gt: since },
      },
      include: {
        user: { select: { id: true, name: true, phoneNumber: true, email: true } },
        movie: { select: { title: true } },
        subscriptionPlan: { select: { name: true } },
      },
    });

    const byRef = new Map(transfers.map((p) => [normalize(p.transferRef!), p]));
    // Longest first so a reference that is a prefix of another can't steal its match
    const refs = [...byRef.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
    const usedRefs = new Set<string>();

    const results = rows.map((row, index) => {
      const text = normalize(row.description ?? '');
      const ref = refs.find((r) => text.includes(r));
      const base = {
        index,
        row: { date: row.date ?? null, amount: row.amount, description: row.description },
      };
      if (!ref) return { ...base, status: 'NO_REFERENCE' as RowStatus, payment: null };

      const payment = byRef.get(ref)!;
      const summary = {
        id: payment.id,
        amount: payment.amount,
        transferRef: payment.transferRef,
        status: payment.status,
        createdAt: payment.createdAt,
        userName: payment.user?.name ?? null,
        item: payment.movie?.title ?? payment.subscriptionPlan?.name ?? null,
        // extras (FMDrama compatible)
        userNotifiedAt: payment.userNotifiedAt,
        user: payment.user,
      };

      let status: RowStatus;
      if (usedRefs.has(ref)) status = 'DUPLICATE';
      else if (payment.status === PaymentStatus.PAID) status = 'ALREADY_PAID';
      else if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.REFUNDED) {
        status = 'NOT_CONFIRMABLE';
      } else if (row.amount < payment.amount) status = 'AMOUNT_LOW';
      else status = 'MATCHED';

      usedRefs.add(ref);
      return { ...base, status, payment: summary };
    });

    const count = (s: RowStatus) => results.filter((r) => r.status === s).length;
    return {
      rows: results,
      summary: {
        matched: count('MATCHED'),
        matchedAmount: results
          .filter((r) => r.status === 'MATCHED')
          .reduce((a, r) => a + r.payment!.amount, 0),
        amountLow: count('AMOUNT_LOW'),
        alreadyPaid: count('ALREADY_PAID'),
        notConfirmable: count('NOT_CONFIRMABLE'),
        duplicate: count('DUPLICATE'),
        noReference: count('NO_REFERENCE'),
        // extras (FMDrama compatible)
        rows: rows.length,
        waitingTransfers: transfers.filter(
          (p) => p.status === PaymentStatus.PENDING && p.userNotifiedAt,
        ).length,
      },
    };
  }

  /**
   * Confirm the approved payments. A transfer that expired because the payer
   * never pressed "I have paid" is revived first — the statement proves the
   * money arrived. An already-PAID payment counts as confirmed (idempotent
   * retries).
   */
  async confirm(paymentIds: string[]) {
    const unique = [...new Set(paymentIds)].slice(0, MAX_CONFIRM);
    const confirmed: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    const confirmOne = async (id: string) => {
      try {
        const payment = await this.prisma.payment.findUnique({ where: { id } });
        if (!payment) throw new Error('Төлбөр олдсонгүй');
        if (payment.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
          throw new Error('Банкны шилжүүлэг биш');
        }
        if (payment.status === PaymentStatus.PAID) {
          confirmed.push(id);
          return;
        }
        if (payment.status === PaymentStatus.EXPIRED) {
          await this.prisma.payment.updateMany({
            where: { id, status: PaymentStatus.EXPIRED },
            data: { status: PaymentStatus.PENDING },
          });
        }
        // Fires entitlement + email + chatbot notifier
        await this.payments.confirmBankTransferPayment(id);
        confirmed.push(id);
      } catch (error) {
        failed.push({ id, reason: (error as Error).message || 'Алдаа' });
      }
    };

    // Small worker pool: fast enough for big statements, gentle on the DB pool
    let next = 0;
    const workers = Array.from({ length: Math.min(CONFIRM_CONCURRENCY, unique.length) }, async () => {
      while (next < unique.length) {
        const id = unique[next++];
        await confirmOne(id);
      }
    });
    await Promise.all(workers);

    this.logger.log(`Bank statement reconcile: ${confirmed.length}/${unique.length} payments confirmed`);
    return { confirmed, failed };
  }
}
