import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminSettingsService } from './admin-settings.service';

@ApiTags('App Config')
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public app configuration (no auth required)' })
  async getAppConfig() {
    const accessMode = await this.adminSettingsService.getAppAccessMode();
    return { accessMode };
  }
}
