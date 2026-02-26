"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSettingsService = exports.SETTINGS_KEYS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma.service");
exports.SETTINGS_KEYS = {
    NOTIFICATION_EMAIL: 'notification_email',
    BANK_TRANSFER_INSTRUCTIONS: 'bank_transfer_instructions',
    SUPPORT_EMAIL: 'support_email',
    SUPPORT_PHONE: 'support_phone',
};
let AdminSettingsService = class AdminSettingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(key) {
        const setting = await this.prisma.adminSettings.findUnique({
            where: { key },
        });
        return setting?.value || null;
    }
    async set(key, value, description) {
        return this.prisma.adminSettings.upsert({
            where: { key },
            create: { key, value, description },
            update: { value, description },
        });
    }
    async getAll() {
        return this.prisma.adminSettings.findMany({
            orderBy: { key: 'asc' },
        });
    }
    async delete(key) {
        await this.prisma.adminSettings.delete({
            where: { key },
        });
    }
    async getNotificationEmail() {
        return this.get(exports.SETTINGS_KEYS.NOTIFICATION_EMAIL);
    }
    async setNotificationEmail(email) {
        return this.set(exports.SETTINGS_KEYS.NOTIFICATION_EMAIL, email, 'Email address for payment notifications');
    }
    async getBankTransferInstructions() {
        return this.get(exports.SETTINGS_KEYS.BANK_TRANSFER_INSTRUCTIONS);
    }
    async setBankTransferInstructions(instructions) {
        return this.set(exports.SETTINGS_KEYS.BANK_TRANSFER_INSTRUCTIONS, instructions, 'Instructions shown to users for bank transfers');
    }
};
exports.AdminSettingsService = AdminSettingsService;
exports.AdminSettingsService = AdminSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminSettingsService);
//# sourceMappingURL=admin-settings.service.js.map