import { User } from '@prisma/client';
export interface AuthStrategyResult {
    user: User;
    isNewUser: boolean;
}
export interface IAuthStrategy {
    readonly name: string;
    authenticate(context: unknown): Promise<AuthStrategyResult>;
}
export declare enum AuthStrategyType {
    DEVICE = "device",
    FACEBOOK = "facebook"
}
