import { Module, forwardRef } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { BunnyService } from './bunny.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [forwardRef(() => AdminModule)],
  controllers: [MoviesController],
  providers: [MoviesService, BunnyService],
  exports: [MoviesService, BunnyService],
})
export class MoviesModule {}
