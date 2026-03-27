import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';
declare class AdminLoginDto {
    username: string;
    password: string;
}
declare class SendOtpDto {
    phoneNumber: string;
}
declare class VerifyOtpDto {
    phoneNumber: string;
    otp: string;
}
export declare class AuthController {
    private authService;
    private configService;
    constructor(authService: AuthService, configService: ConfigService);
    sendOtp(dto: SendOtpDto): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
        accessToken: string;
        user: Omit<User, "password">;
    }>;
    facebookLogin(req: any): void;
    facebookCallback(req: any, res: Response): Promise<void>;
    getProfile(user: User): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        email: string | null;
        facebookId: string | null;
        phoneNumber: string | null;
        avatar: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        isTestAccount: boolean;
    }>;
    adminLogin(dto: AdminLoginDto): Promise<{
        accessToken: string;
    }>;
    private parseState;
    private buildRedirectUrl;
    private normalizeFrontendUrl;
    private safeParseUrl;
}
export {};
