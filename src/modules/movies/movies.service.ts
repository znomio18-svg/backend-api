import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';
import { BunnyService } from './bunny.service';
import { Movie, Prisma } from '@prisma/client';

export interface CreateMovieDto {
  title: string;
  description: string;
  thumbnailUrl: string;
  trailerVideoId?: string;
  videoId: string;
  duration: number;
  releaseYear: number;
  isFeatured?: boolean;
  isPublished?: boolean;
}

export interface UpdateMovieDto extends Partial<CreateMovieDto> {}

export interface MovieListParams {
  page?: number;
  limit?: number;
  search?: string;
  featured?: boolean;
  sortBy?: 'createdAt' | 'title' | 'rating' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
  isPublished?: boolean;
}

@Injectable()
export class MoviesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private bunnyService: BunnyService,
  ) {}

  async create(data: CreateMovieDto): Promise<Movie> {
    const movie = await this.prisma.movie.create({
      data,
    });

    await this.redis.flushPattern('movies:*');
    return movie;
  }

  async findAll(params: MovieListParams) {
    const {
      page: rawPage = 1,
      limit: rawLimit = 12,
      search,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isPublished,
    } = params;

    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const skip = (page - 1) * limit;

    const where: Prisma.MovieWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (featured !== undefined) {
      where.isFeatured = featured;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    const orderBy: Prisma.MovieOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [movies, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.movie.count({ where }),
    ]);

    return {
      movies: movies.map((m) => this.resolveMovieUrls(m)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<Movie> {
    const cached = await this.redis.getJson<Movie>(`movie:${id}`);
    if (cached) return this.resolveMovieUrls(cached);

    const movie = await this.prisma.movie.findUnique({
      where: { id },
    });

    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    await this.redis.setJson(`movie:${id}`, movie, 300);
    return this.resolveMovieUrls(movie);
  }

  async update(id: string, data: UpdateMovieDto): Promise<Movie> {
    const movie = await this.prisma.movie.update({
      where: { id },
      data,
    });

    await this.redis.del(`movie:${id}`);
    await this.redis.flushPattern('movies:*');

    return movie;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.movie.delete({
      where: { id },
    });

    await this.redis.del(`movie:${id}`);
    await this.redis.flushPattern('movies:*');
  }

  async getMovieWithStreamUrl(
    movieId: string,
  ): Promise<Movie & { streamUrl: string }> {
    const movie = await this.findOne(movieId);
    const streamUrl = this.bunnyService.generateSignedUrl(movie.videoId, 14400);
    return { ...movie, streamUrl };
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.movie.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async getFeaturedMovies(): Promise<Movie[]> {
    const cached = await this.redis.getJson<Movie[]>('movies:featured');
    if (cached) return cached.map((m) => this.resolveMovieUrls(m));

    const movies = await this.prisma.movie.findMany({
      where: { isPublished: true, isFeatured: true },
      orderBy: { createdAt: 'desc' },
    });

    await this.redis.setJson('movies:featured', movies, 300);
    return movies.map((m) => this.resolveMovieUrls(m));
  }

  async getTrailerUrls(
    movieId: string,
  ): Promise<{ streamUrl: string; embedUrl: string } | null> {
    const movie = await this.findOne(movieId);

    if (!movie.trailerVideoId) {
      return null;
    }

    return {
      streamUrl: this.bunnyService.getTrailerStreamUrl(movie.trailerVideoId),
      embedUrl: this.bunnyService.getTrailerEmbedUrl(movie.trailerVideoId),
    };
  }

  async getStats() {
    const [totalMovies, publishedMovies, featuredMovies, totalViews] = await Promise.all([
      this.prisma.movie.count(),
      this.prisma.movie.count({ where: { isPublished: true } }),
      this.prisma.movie.count({ where: { isFeatured: true } }),
      this.prisma.movie.aggregate({
        _sum: { viewCount: true },
      }),
    ]);

    return {
      totalMovies,
      publishedMovies,
      featuredMovies,
      draftMovies: totalMovies - publishedMovies,
      totalViews: totalViews._sum.viewCount || 0,
    };
  }

  private resolveMovieUrls<T extends Movie>(movie: T): T {
    return {
      ...movie,
      thumbnailUrl: this.bunnyService.resolveImageUrl(movie.thumbnailUrl),
    };
  }
}
