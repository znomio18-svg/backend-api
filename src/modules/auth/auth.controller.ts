import { Controller, Get, Post, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { FacebookAuthGuard } from './guards/facebook-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

class AdminLoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

class SendOtpDto {
  @ApiProperty({ example: '99112233', description: 'Mongolian phone number (8 digits)' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

class VerifyOtpDto {
  @ApiProperty({ example: '99112233' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: '1234', description: '4-digit OTP code' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 4)
  otp: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * Send OTP to phone number.
   */
  @Post('otp/send')
  @Public()
  @ApiOperation({ summary: 'Send OTP code to phone number' })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phoneNumber);
  }

  /**
   * Verify OTP and login.
   */
  @Post('otp/verify')
  @Public()
  @ApiOperation({ summary: 'Verify OTP code and login' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phoneNumber, dto.otp);
  }

  /**
   * Initiate Facebook OAuth login.
   * Redirects the user to Facebook's login page.
   */
  @Get('facebook')
  @Public()
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiQuery({ name: 'platform', required: false, description: 'web | app' })
  @ApiQuery({ name: 'redirect', required: false, description: 'Redirect URL after login' })
  facebookLogin(@Req() req: any) {
    // Passport handles the redirect to Facebook
  }

  /**
   * Facebook OAuth callback.
   * After Facebook authenticates the user, Passport populates req.user.
   * We issue a JWT and redirect to the frontend with the token.
   */
  @Get('facebook/callback')
  @Public()
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  async facebookCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = await this.authService.login(req.user);
    const { platform, redirect } = this.parseState(
      typeof req.query?.state === 'string' ? req.query.state : undefined,
    );
    const redirectUrl = this.buildRedirectUrl(platform, redirect, accessToken);
    res.redirect(redirectUrl);
  }

  /**
   * Get current authenticated user profile.
   * Requires valid JWT Bearer token.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile (requires JWT)' })
  async getProfile(@CurrentUser() user: User) {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Admin login (JWT-based, username + password)
   */
  @Post('admin/login')
  @Public()
  @ApiOperation({ summary: 'Admin login with username and password (JWT)' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.username, dto.password);
  }

  private parseState(state?: string): { platform: 'web' | 'app'; redirect?: string } {
    if (!state) return { platform: 'web' };

    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
        platform?: string;
        redirect?: string;
      };

      return {
        platform: parsed.platform === 'app' ? 'app' : 'web',
        redirect: typeof parsed.redirect === 'string' ? parsed.redirect : undefined,
      };
    } catch {
      return { platform: 'web' };
    }
  }

  private buildRedirectUrl(
    platform: 'web' | 'app',
    requestedRedirect: string | undefined,
    accessToken: string,
  ): string {
    const frontendUrl = this.normalizeFrontendUrl(
      this.configService.get<string>('FRONTEND_URL'),
    );
    const appRedirectDefault =
      this.configService.get<string>('MOBILE_APP_REDIRECT_URI') || 'mindramaapp://auth/callback';
    const appRedirectPrefix =
      this.configService.get<string>('MOBILE_APP_REDIRECT_PREFIX') || appRedirectDefault;

    let target: string;

    if (platform === 'app') {
      const isAllowedAppRedirect =
        typeof requestedRedirect === 'string' &&
        requestedRedirect.startsWith(appRedirectPrefix);
      target = isAllowedAppRedirect ? requestedRedirect : appRedirectDefault;
    } else {
      const defaultWebCallback = new URL('/auth/callback', frontendUrl).toString();
      if (!requestedRedirect) {
        target = defaultWebCallback;
      } else {
        try {
          const candidate = new URL(requestedRedirect, frontendUrl);
          const frontendOrigin = new URL(frontendUrl).origin;
          target = candidate.origin === frontendOrigin ? candidate.toString() : defaultWebCallback;
        } catch {
          target = defaultWebCallback;
        }
      }
    }

    const redirectUrl = this.safeParseUrl(
      target,
      new URL('/auth/callback', frontendUrl).toString(),
    );
    redirectUrl.searchParams.set('token', accessToken);
    return redirectUrl.toString();
  }

  private normalizeFrontendUrl(value?: string): string {
    const fallback = 'http://localhost:3000';
    if (!value || value.trim().length === 0) return fallback;

    const trimmed = value.trim();

    try {
      return new URL(trimmed).toString();
    } catch {
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return fallback;
      }
    }
  }

  private safeParseUrl(value: string, fallback: string): URL {
    try {
      return new URL(value);
    } catch {
      return new URL(fallback);
    }
  }
}
