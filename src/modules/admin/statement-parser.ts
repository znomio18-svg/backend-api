// Ported from chat-bot/src/admin/statement-parser.ts (FMDrama). Namespace import:
// this project compiles without esModuleInterop.
import * as ExcelJS from 'exceljs';

export interface StatementRow {
  date?: string;
  amount: number;
  description: string;
}

export interface ParsedStatement {
  rows: StatementRow[];
  columns: { date: string | null; amount: string; description: string };
  totalLines: number;
}

// Header names used by Mongolian banks' statement exports (and English ones)
const DESCRIPTION = /гүйлгээний утга|утга|тайлбар|description|narrative|details|purpose|reference/i;
const CREDIT = /кредит|credit|орлого|орсон|deposit|зарлагагүй|incoming/i;
const AMOUNT = /гүйлгээний дүн|дүн|amount|sum/i;
const DATE = /огноо|date|хугацаа/i;

export class StatementFormatError extends Error {}

/** "1 234 567.00", "1,234,567", "(5,000)" → number; negative for debits. */
function parseNumber(value: string): number {
  const text = value.trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text) || text.startsWith('-');
  const digits = text.replace(/[()\s-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(digits.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? (negative ? -n : n) : 0;
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new StatementFormatError('Excel файлыг уншиж чадсангүй. Хуучин .xls бол Excel-ээр нээгээд .xlsx эсвэл .csv болгож хадгална уу.');
  }
  // The sheet with the most rows is the statement
  const sheet = [...workbook.worksheets].sort((a, b) => b.rowCount - a.rowCount)[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = (cell.text ?? '').toString();
    });
    rows.push(Array.from(cells, (c) => c ?? ''));
  });
  return rows;
}

/**
 * Turn a bank statement export into credit lines. Finds the header row by
 * its column names, so it works across banks without per-bank templates.
 */
export async function parseStatement(filename: string, buffer: Buffer): Promise<ParsedStatement> {
  const isCsv = /\.(csv|txt)$/i.test(filename);
  const table = isCsv ? parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, '')) : await parseXlsx(buffer);

  let headerIndex = -1;
  let cols = { date: -1, credit: -1, amount: -1, description: -1 };
  for (let i = 0; i < Math.min(table.length, 25); i++) {
    const cells = table[i].map((c) => (c ?? '').toString().trim());
    const description = cells.findIndex((c) => DESCRIPTION.test(c));
    const credit = cells.findIndex((c) => CREDIT.test(c));
    const amount = cells.findIndex((c, idx) => AMOUNT.test(c) && idx !== description);
    if (description >= 0 && (credit >= 0 || amount >= 0)) {
      headerIndex = i;
      cols = { date: cells.findIndex((c) => DATE.test(c)), credit, amount, description };
      break;
    }
  }
  if (headerIndex < 0) {
    throw new StatementFormatError(
      'Хуулгын гарчгийн мөр олдсонгүй. "Гүйлгээний утга" болон "Кредит"/"Дүн" гэсэн баганатай файл оруулна уу.',
    );
  }

  const header = table[headerIndex];
  const amountCol = cols.credit >= 0 ? cols.credit : cols.amount;
  const rows: StatementRow[] = [];
  const body = table.slice(headerIndex + 1);

  for (const line of body) {
    const description = (line[cols.description] ?? '').toString().trim();
    const amount = parseNumber((line[amountCol] ?? '').toString());
    // Credits only: money that came in
    if (!description || amount <= 0) continue;
    rows.push({
      amount: Math.round(amount),
      description: description.slice(0, 500),
      ...(cols.date >= 0 && line[cols.date] ? { date: String(line[cols.date]).trim().slice(0, 40) } : {}),
    });
  }

  return {
    rows,
    totalLines: body.length,
    columns: {
      date: cols.date >= 0 ? String(header[cols.date]) : null,
      amount: String(header[amountCol]),
      description: String(header[cols.description]),
    },
  };
}
