import { Module } from '@nestjs/common';
import { MoviesModule } from '../movies/movies.module';
import { WatchAccessController } from './watch-access.controller';
import { WatchAccessService } from './watch-access.service';

@Module({
  imports: [MoviesModule],
  controllers: [WatchAccessController],
  providers: [WatchAccessService],
  exports: [WatchAccessService],
})
export class WatchAccessModule {}
