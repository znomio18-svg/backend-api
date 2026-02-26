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
exports.DeviceAuthGuard = exports.DEVICE_ID_HEADER = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const device_strategy_1 = require("../auth/device.strategy");
const public_decorator_1 = require("../decorators/public.decorator");
exports.DEVICE_ID_HEADER = 'x-device-id';
let DeviceAuthGuard = class DeviceAuthGuard {
    constructor(deviceStrategy, reflector) {
        this.deviceStrategy = deviceStrategy;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const request = context.switchToHttp().getRequest();
        const deviceId = request.headers[exports.DEVICE_ID_HEADER];
        if (isPublic && !deviceId) {
            return true;
        }
        if (deviceId) {
            if (!this.isValidDeviceId(deviceId)) {
                throw new common_1.BadRequestException('Invalid device ID format');
            }
            const { user } = await this.deviceStrategy.authenticate({ deviceId });
            request.user = user;
            return true;
        }
        if (!isPublic) {
            throw new common_1.BadRequestException('Device ID required. Please include x-device-id header.');
        }
        return true;
    }
    isValidDeviceId(deviceId) {
        const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidV4Pattern.test(deviceId);
    }
};
exports.DeviceAuthGuard = DeviceAuthGuard;
exports.DeviceAuthGuard = DeviceAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [device_strategy_1.DeviceStrategy,
        core_1.Reflector])
], DeviceAuthGuard);
//# sourceMappingURL=device-auth.guard.js.map