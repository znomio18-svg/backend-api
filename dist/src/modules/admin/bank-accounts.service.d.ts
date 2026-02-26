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
export interface UpdateBankAccountDto extends Partial<CreateBankAccountDto> {
}
export declare class BankAccountsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(data: CreateBankAccountDto): Promise<BankAccount>;
    findAll(includeInactive?: boolean): Promise<BankAccount[]>;
    findOne(id: string): Promise<BankAccount>;
    update(id: string, data: UpdateBankAccountDto): Promise<BankAccount>;
    delete(id: string): Promise<void>;
    getActiveBankAccounts(): Promise<BankAccount[]>;
}
