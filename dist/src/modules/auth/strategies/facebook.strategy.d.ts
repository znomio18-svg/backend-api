import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
declare const FacebookStrategy_base: new (...args: any[]) => Strategy;
export declare class FacebookStrategy extends FacebookStrategy_base {
    private authService;
    constructor(authService: AuthService, configService: ConfigService);
    validate(accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void): Promise<void>;
}
export {};
