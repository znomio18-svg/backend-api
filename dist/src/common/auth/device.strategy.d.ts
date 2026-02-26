import { PrismaService } from '../../config/prisma.service';
import { IAuthStrategy, AuthStrategyResult } from './auth-strategy.interface';
import { User } from '@prisma/client';
export interface DeviceAuthContext {
    deviceId: string;
}
export declare class DeviceStrategy implements IAuthStrategy {
    private readonly prisma;
    readonly name = "device";
    constructor(prisma: PrismaService);
    authenticate(context: DeviceAuthContext): Promise<AuthStrategyResult>;
    findByDeviceId(deviceId: string): Promise<User | null>;
    linkFacebookAccount(deviceId: string, facebookId: string, name: string, email?: string, avatar?: string): Promise<User>;
}
