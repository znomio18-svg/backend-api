import { Controller, Get, Post, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { Response } from 'express';
import { AuthService } from './auth.service';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * Initiate Facebook OAuth login.
   * Redirects the user to Facebook's login page.
   */
  @Get('facebook')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
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
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  async facebookCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken, user } = await this.authService.login(req.user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${accessToken}`;

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
}
