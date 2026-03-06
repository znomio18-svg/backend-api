import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

type FacebookLoginState = {
  platform: 'web' | 'app';
  redirect?: string;
};

function encodeState(payload: FacebookLoginState): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

@Injectable()
export class FacebookAuthGuard extends AuthGuard('facebook') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const path = req?.path ?? '';

    // Callback request already contains code/state from Facebook.
    if (path.endsWith('/facebook/callback')) {
      return undefined;
    }

    const platform = req?.query?.platform === 'app' ? 'app' : 'web';
    const redirect =
      typeof req?.query?.redirect === 'string' && req.query.redirect.length > 0
        ? req.query.redirect
        : undefined;

    return {
      session: false,
      state: encodeState({ platform, redirect }),
    };
  }
}
