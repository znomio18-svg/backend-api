import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { DevicePlatform, User } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';

import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class RegisterPushTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;

  @ApiProperty({ enum: DevicePlatform, enumName: 'DevicePlatform' })
  @IsEnum(DevicePlatform)
  devicePlatform: DevicePlatform;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

class UnregisterPushTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me/subscription')
  @ApiOperation({ summary: 'Get current user subscription status' })
  async getMySubscription(@CurrentUser() user: User) {
    return this.usersService.getUserSubscriptionStatus(user.id);
  }

  @Post('me/push-tokens')
  @ApiOperation({ summary: 'Register Expo push token for current user' })
  async registerPushToken(@CurrentUser() user: User, @Body() dto: RegisterPushTokenDto) {
    return this.usersService.registerPushToken(user.id, dto);
  }

  @Delete('me/push-tokens')
  @ApiOperation({ summary: 'Unregister Expo push token for current user' })
  async unregisterPushToken(@CurrentUser() user: User, @Body() dto: UnregisterPushTokenDto) {
    return this.usersService.unregisterPushToken(user.id, dto.expoPushToken);
  }
}
