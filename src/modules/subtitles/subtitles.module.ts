import { Module } from '@nestjs/common';
import { MoviesModule } from '../movies/movies.module';
import { SubtitlesService } from './subtitles.service';

@Module({
  imports: [MoviesModule],
  providers: [SubtitlesService],
  exports: [SubtitlesService],
})
export class SubtitlesModule {}
