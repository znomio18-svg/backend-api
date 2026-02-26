import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookStrategy.name);

  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    const clientID = configService.get<string>('FACEBOOK_APP_ID') || 'not-configured';
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET') || 'not-configured';
    const callbackURL = configService.get<string>('FACEBOOK_CALLBACK_URL') || 'http://localhost/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email'],
      profileFields: ['id', 'displayName', 'photos', 'email'],
    });

    if (clientID === 'not-configured') {
      this.logger.warn('Facebook OAuth not configured. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_CALLBACK_URL environment variables.');
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any) => void,
  ): Promise<void> {
    try {
      const user = await this.authService.validateFacebookUser({
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails,
        photos: profile.photos,
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}
