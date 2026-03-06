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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const auth_service_1 = require("./auth.service");
const facebook_auth_guard_1 = require("./guards/facebook-auth.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
class AdminLoginDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminLoginDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'password' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminLoginDto.prototype, "password", void 0);
let AuthController = class AuthController {
    constructor(authService, configService) {
        this.authService = authService;
        this.configService = configService;
    }
    facebookLogin(req) {
    }
    async facebookCallback(req, res) {
        const { accessToken } = await this.authService.login(req.user);
        const { platform, redirect } = this.parseState(typeof req.query?.state === 'string' ? req.query.state : undefined);
        const redirectUrl = this.buildRedirectUrl(platform, redirect, accessToken);
        res.redirect(redirectUrl);
    }
    async getProfile(user) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    async adminLogin(dto) {
        return this.authService.adminLogin(dto.username, dto.password);
    }
    parseState(state) {
        if (!state)
            return { platform: 'web' };
        try {
            const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
            return {
                platform: parsed.platform === 'app' ? 'app' : 'web',
                redirect: typeof parsed.redirect === 'string' ? parsed.redirect : undefined,
            };
        }
        catch {
            return { platform: 'web' };
        }
    }
    buildRedirectUrl(platform, requestedRedirect, accessToken) {
        const frontendUrl = this.normalizeFrontendUrl(this.configService.get('FRONTEND_URL'));
        const appRedirectDefault = this.configService.get('MOBILE_APP_REDIRECT_URI') || 'mindramaapp://auth/callback';
        const appRedirectPrefix = this.configService.get('MOBILE_APP_REDIRECT_PREFIX') || appRedirectDefault;
        let target;
        if (platform === 'app') {
            const isAllowedAppRedirect = typeof requestedRedirect === 'string' &&
                requestedRedirect.startsWith(appRedirectPrefix);
            target = isAllowedAppRedirect ? requestedRedirect : appRedirectDefault;
        }
        else {
            const defaultWebCallback = new URL('/auth/callback', frontendUrl).toString();
            if (!requestedRedirect) {
                target = defaultWebCallback;
            }
            else {
                try {
                    const candidate = new URL(requestedRedirect, frontendUrl);
                    const frontendOrigin = new URL(frontendUrl).origin;
                    target = candidate.origin === frontendOrigin ? candidate.toString() : defaultWebCallback;
                }
                catch {
                    target = defaultWebCallback;
                }
            }
        }
        const redirectUrl = this.safeParseUrl(target, new URL('/auth/callback', frontendUrl).toString());
        redirectUrl.searchParams.set('token', accessToken);
        return redirectUrl.toString();
    }
    normalizeFrontendUrl(value) {
        const fallback = 'http://localhost:3000';
        if (!value || value.trim().length === 0)
            return fallback;
        const trimmed = value.trim();
        try {
            return new URL(trimmed).toString();
        }
        catch {
            try {
                return new URL(`https://${trimmed}`).toString();
            }
            catch {
                return fallback;
            }
        }
    }
    safeParseUrl(value, fallback) {
        try {
            return new URL(value);
        }
        catch {
            return new URL(fallback);
        }
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('facebook'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(facebook_auth_guard_1.FacebookAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate Facebook OAuth login' }),
    (0, swagger_1.ApiQuery)({ name: 'platform', required: false, description: 'web | app' }),
    (0, swagger_1.ApiQuery)({ name: 'redirect', required: false, description: 'Redirect URL after login' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "facebookLogin", null);
__decorate([
    (0, common_1.Get)('facebook/callback'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(facebook_auth_guard_1.FacebookAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Facebook OAuth callback' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "facebookCallback", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile (requires JWT)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)('admin/login'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Admin login with username and password (JWT)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AdminLoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "adminLogin", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map