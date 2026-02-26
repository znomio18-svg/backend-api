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
var FacebookStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_facebook_1 = require("passport-facebook");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("../auth.service");
let FacebookStrategy = FacebookStrategy_1 = class FacebookStrategy extends (0, passport_1.PassportStrategy)(passport_facebook_1.Strategy, 'facebook') {
    constructor(authService, configService) {
        const clientID = configService.get('FACEBOOK_APP_ID') || 'not-configured';
        const clientSecret = configService.get('FACEBOOK_APP_SECRET') || 'not-configured';
        const callbackURL = configService.get('FACEBOOK_CALLBACK_URL') || 'http://localhost/callback';
        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['email'],
            profileFields: ['id', 'displayName', 'photos', 'email'],
        });
        this.authService = authService;
        this.logger = new common_1.Logger(FacebookStrategy_1.name);
        if (clientID === 'not-configured') {
            this.logger.warn('Facebook OAuth not configured. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL environment variables.');
        }
    }
    async validate(accessToken, refreshToken, profile, done) {
        try {
            const user = await this.authService.validateFacebookUser({
                id: profile.id,
                displayName: profile.displayName,
                emails: profile.emails,
                photos: profile.photos,
            });
            done(null, user);
        }
        catch (error) {
            done(error, null);
        }
    }
};
exports.FacebookStrategy = FacebookStrategy;
exports.FacebookStrategy = FacebookStrategy = FacebookStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], FacebookStrategy);
//# sourceMappingURL=facebook.strategy.js.map