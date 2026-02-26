import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { BankAccount } from '@prisma/client';

export interface CreateBankAccountDto {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateBankAccountDto extends Partial<CreateBankAccountDto> {}

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateBankAccountDto): Promise<BankAccount> {
    return this.prisma.bankAccount.create({
      data,
    });
  }

  async findAll(includeInactive = false): Promise<BankAccount[]> {
    return this.prisma.bankAccount.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string): Promise<BankAccount> {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    return bankAccount;
  }

  async update(id: string, data: UpdateBankAccountDto): Promise<BankAccount> {
    await this.findOne(id); // Throws if not found

    return this.prisma.bankAccount.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id); // Throws if not found

    await this.prisma.bankAccount.delete({
      where: { id },
    });
  }

  async getActiveBankAccounts(): Promise<BankAccount[]> {
    return this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
