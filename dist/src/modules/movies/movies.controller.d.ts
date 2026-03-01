import { User } from '@prisma/client';
import { MoviesService, MovieListParams } from './movies.service';
export declare class MoviesController {
    private moviesService;
    constructor(moviesService: MoviesService);
    findAll(query: MovieListParams): Promise<{
        movies: {
            id: string;
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
            price: number | null;
            createdAt: Date;
            updatedAt: Date;
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
    getFeatured(): Promise<{
        id: string;
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
        price: number | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getPurchasedMovies(user: User): Promise<{
        id: string;
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
        price: number | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
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
        price: number | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getTrailerUrl(id: string): Promise<{
        streamUrl: string;
        embedUrl: string;
    } | null>;
    getStreamUrl(id: string): Promise<{
        id: string;
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
        price: number | null;
        createdAt: Date;
        updatedAt: Date;
    } & {
        streamUrl: string;
    }>;
    incrementView(id: string): Promise<{
        success: boolean;
    }>;
}
