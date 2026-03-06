"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
function encodeState(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}
let FacebookAuthGuard = class FacebookAuthGuard extends (0, passport_1.AuthGuard)('facebook') {
    getAuthenticateOptions(context) {
        const req = context.switchToHttp().getRequest();
        const path = req?.path ?? '';
        if (path.endsWith('/facebook/callback')) {
            return undefined;
        }
        const platform = req?.query?.platform === 'app' ? 'app' : 'web';
        const redirect = typeof req?.query?.redirect === 'string' && req.query.redirect.length > 0
            ? req.query.redirect
            : undefined;
        return {
            session: false,
            state: encodeState({ platform, redirect }),
        };
    }
};
exports.FacebookAuthGuard = FacebookAuthGuard;
exports.FacebookAuthGuard = FacebookAuthGuard = __decorate([
    (0, common_1.Injectable)()
], FacebookAuthGuard);
//# sourceMappingURL=facebook-auth.guard.js.map