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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../config/prisma.service");
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
let AuthService = class AuthService {
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async adminLogin(username, password) {
        const adminUsername = this.configService.get('ADMIN_USERNAME');
        const adminPassword = this.configService.get('ADMIN_PASSWORD');
        const admin2Username = this.configService.get('ADMIN2_USERNAME');
        const admin2Password = this.configService.get('ADMIN2_PASSWORD');
        let envPassword;
        let adminIdentifier;
        if (username === adminUsername) {
            envPassword = adminPassword;
            adminIdentifier = 'admin';
        }
        else if (admin2Username && username === admin2Username) {
            envPassword = admin2Password;
            adminIdentifier = 'admin2';
        }
        else {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const adminEmail = adminIdentifier === 'admin' ? 'admin@1MinDrama.mn' : 'admin2@1MinDrama.mn';
        let adminUser = await this.prisma.user.findFirst({
            where: { facebookId: adminIdentifier, role: client_1.UserRole.ADMIN },
        });
        if (!adminUser) {
            adminUser = await this.prisma.user.findFirst({
                where: { email: adminEmail, role: client_1.UserRole.ADMIN },
            });
            if (adminUser && adminUser.facebookId !== adminIdentifier) {
                adminUser = await this.prisma.user.update({
                    where: { id: adminUser.id },
                    data: { facebookId: adminIdentifier },
                });
            }
        }
        if (!adminUser) {
            adminUser = await this.prisma.user.create({
                data: {
                    facebookId: adminIdentifier,
                    name: adminIdentifier === 'admin' ? 'Admin' : 'Admin 2',
                    email: adminEmail,
                    role: client_1.UserRole.ADMIN,
                },
            });
        }
        let isValidPassword = false;
        if (adminUser.password) {
            isValidPassword = await bcrypt.compare(password, adminUser.password);
        }
        else {
            isValidPassword = password === envPassword;
        }
        if (!isValidPassword) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = {
            sub: adminUser.id,
            facebookId: adminUser.facebookId,
            role: adminUser.role,
        };
        return {
            accessToken: this.jwtService.sign(payload),
        };
    }
    async changeAdminPassword(userId, currentPassword, newPassword) {
        const adminUser = await this.prisma.user.findFirst({
            where: { id: userId, role: client_1.UserRole.ADMIN },
        });
        if (!adminUser) {
            throw new common_1.UnauthorizedException('Admin user not found');
        }
        const adminPassword = this.configService.get('ADMIN_PASSWORD');
        let isValidPassword = false;
        if (adminUser.password) {
            isValidPassword = await bcrypt.compare(currentPassword, adminUser.password);
        }
        else {
            isValidPassword = currentPassword === adminPassword;
        }
        if (!isValidPassword) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        return { success: true };
    }
    async validateFacebookUser(profile) {
        const { id: facebookId, displayName, emails, photos } = profile;
        const email = emails?.[0]?.value;
        let user = await this.prisma.user.findUnique({
            where: { facebookId },
        });
        if (!user && email) {
            user = await this.prisma.user.findUnique({
                where: { email },
            });
            if (user) {
                user = await this.prisma.user.update({
                    where: { email },
                    data: {
                        facebookId,
                        name: displayName,
                        avatar: photos?.[0]?.value,
                    },
                });
            }
        }
        if (!user) {
            try {
                user = await this.prisma.user.create({
                    data: {
                        facebookId,
                        name: displayName,
                        email,
                        avatar: photos?.[0]?.value,
                    },
                });
            }
            catch (error) {
                if (error.code === 'P2002') {
                    if (email) {
                        user = await this.prisma.user.findUnique({ where: { email } });
                        if (user) {
                            user = await this.prisma.user.update({
                                where: { email },
                                data: {
                                    facebookId,
                                    name: displayName,
                                    avatar: photos?.[0]?.value,
                                },
                            });
                        }
                    }
                    if (!user) {
                        user = await this.prisma.user.findUnique({ where: { facebookId } });
                    }
                    if (!user) {
                        throw error;
                    }
                }
                else {
                    throw error;
                }
            }
        }
        else if (user.facebookId === facebookId) {
            user = await this.prisma.user.update({
                where: { facebookId },
                data: {
                    name: displayName,
                    avatar: photos?.[0]?.value,
                },
            });
        }
        return user;
    }
    async login(user) {
        const payload = {
            sub: user.id,
            facebookId: user.facebookId,
            role: user.role,
        };
        const { password: _, ...userWithoutPassword } = user;
        return {
            accessToken: this.jwtService.sign(payload),
            user: userWithoutPassword,
        };
    }
    async validateUserById(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map