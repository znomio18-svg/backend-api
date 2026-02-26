import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';
import { BunnyService } from './bunny.service';
import { Movie } from '@prisma/client';
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
export interface UpdateMovieDto extends Partial<CreateMovieDto> {
}
export interface MovieListParams {
    page?: number;
    limit?: number;
    search?: string;
    featured?: boolean;
    sortBy?: 'createdAt' | 'title' | 'rating' | 'viewCount';
    sortOrder?: 'asc' | 'desc';
    isPublished?: boolean;
}
export declare class MoviesService {
    private prisma;
    private redis;
    private bunnyService;
    constructor(prisma: PrismaService, redis: RedisService, bunnyService: BunnyService);
    create(data: CreateMovieDto): Promise<Movie>;
    findAll(params: MovieListParams): Promise<{
        movies: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string;
            thumbnailUrl: string;
            trailerVideoId: string | null;
            videoId: string;
            duration: number;
            releaseYear: number;
            rating: number;
            viewCount: number;
            isFeatured: boolean;
            isPublished: boolean;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    findOne(id: string): Promise<Movie>;
    update(id: string, data: UpdateMovieDto): Promise<Movie>;
    delete(id: string): Promise<void>;
    getMovieWithStreamUrl(movieId: string): Promise<Movie & {
        streamUrl: string;
    }>;
    incrementViewCount(id: string): Promise<void>;
    getFeaturedMovies(): Promise<Movie[]>;
    getTrailerUrls(movieId: string): Promise<{
        streamUrl: string;
        embedUrl: string;
    } | null>;
    getStats(): Promise<{
        totalMovies: number;
        publishedMovies: number;
        featuredMovies: number;
        draftMovies: number;
        totalViews: number;
    }>;
    private resolveMovieUrls;
}
