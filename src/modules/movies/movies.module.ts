import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { BunnyService } from './bunny.service';

@Module({
  controllers: [MoviesController],
  providers: [MoviesService, BunnyService],
  exports: [MoviesService, BunnyService],
})
export class MoviesModule {}
