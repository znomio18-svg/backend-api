import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private authService;
    constructor(authService: AuthService, configService: ConfigService);
    validate(payload: JwtPayload): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        email: string | null;
        facebookId: string | null;
        phoneNumber: string | null;
        avatar: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        isTestAccount: boolean;
    }>;
}
export {};
