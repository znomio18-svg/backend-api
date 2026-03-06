import { ExecutionContext } from '@nestjs/common';
declare const FacebookAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class FacebookAuthGuard extends FacebookAuthGuard_base {
    getAuthenticateOptions(context: ExecutionContext): {
        session: boolean;
        state: string;
    } | undefined;
}
export {};
