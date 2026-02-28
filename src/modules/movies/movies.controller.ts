import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { MoviesService, MovieListParams } from './movies.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@ApiTags('Movies')
@Controller('movies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MoviesController {
  constructor(private moviesService: MoviesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all published movies with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'title', 'rating', 'viewCount'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async findAll(@Query() query: MovieListParams) {
    return this.moviesService.findAll({
      ...query,
      isPublished: true,
    });
  }

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Get featured movies' })
  async getFeatured() {
    return this.moviesService.getFeaturedMovies();
  }

  @Get('purchased')
  @ApiOperation({ summary: 'Get movies purchased by the current user' })
  async getPurchasedMovies(@CurrentUser() user: User) {
    return this.moviesService.getUserPurchasedMovies(user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get movie details (metadata only, no stream URL)' })
  async findOne(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }

  @Get(':id/trailer')
  @Public()
  @ApiOperation({ summary: 'Get movie trailer URL (public)' })
  async getTrailerUrl(@Param('id') id: string) {
    return this.moviesService.getTrailerUrls(id);
  }

  @Get(':id/stream')
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: 'Get movie stream URL (requires active subscription)' })
  async getStreamUrl(@Param('id') id: string) {
    return this.moviesService.getMovieWithStreamUrl(id);
  }

  @Post(':id/view')
  @Public()
  @ApiOperation({ summary: 'Increment movie view count' })
  async incrementView(@Param('id') id: string) {
    await this.moviesService.incrementViewCount(id);
    return { success: true };
  }
}
