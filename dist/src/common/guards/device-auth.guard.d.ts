import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DeviceStrategy } from '../auth/device.strategy';
export declare const DEVICE_ID_HEADER = "x-device-id";
export declare class DeviceAuthGuard implements CanActivate {
    private readonly deviceStrategy;
    private readonly reflector;
    constructor(deviceStrategy: DeviceStrategy, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private isValidDeviceId;
}
