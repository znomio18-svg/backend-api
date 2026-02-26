import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';
declare class AdminLoginDto {
    username: string;
    password: string;
}
export declare class AuthController {
    private authService;
    private configService;
    constructor(authService: AuthService, configService: ConfigService);
    facebookLogin(req: any): void;
    facebookCallback(req: any, res: Response): Promise<void>;
    getProfile(user: User): Promise<{
        id: string;
        facebookId: string;
        email: string | null;
        name: string;
        avatar: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        createdAt: Date;
        updatedAt: Date;
    }>;
    adminLogin(dto: AdminLoginDto): Promise<{
        accessToken: string;
    }>;
}
export {};
