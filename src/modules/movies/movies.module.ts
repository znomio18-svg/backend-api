import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { BunnyService } from './bunny.service';
import { AdminSettingsService } from '../admin/admin-settings.service';

@Module({
  controllers: [MoviesController],
  providers: [MoviesService, BunnyService, AdminSettingsService],
  exports: [MoviesService, BunnyService],
})
export class MoviesModule {}
