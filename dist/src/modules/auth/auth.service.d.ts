import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { User } from '@prisma/client';
export interface FacebookProfile {
    id: string;
    displayName: string;
    emails?: {
        value: string;
    }[];
    photos?: {
        value: string;
    }[];
}
export interface JwtPayload {
    sub: string;
    facebookId: string;
    role: string;
}
export declare class AuthService {
    private prisma;
    private jwtService;
    private configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    adminLogin(username: string, password: string): Promise<{
        accessToken: string;
    }>;
    changeAdminPassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
    }>;
    validateFacebookUser(profile: FacebookProfile): Promise<User>;
    login(user: User): Promise<{
        accessToken: string;
        user: Omit<User, 'password'>;
    }>;
    validateUserById(userId: string): Promise<User | null>;
}
