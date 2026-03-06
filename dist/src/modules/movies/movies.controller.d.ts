import { User } from '@prisma/client';
import { MoviesService, MovieListParams } from './movies.service';
export declare class MoviesController {
    private moviesService;
    constructor(moviesService: MoviesService);
    findAll(query: MovieListParams): Promise<{
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
            price: number | null;
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
        price: number | null;
    }[]>;
    getPurchasedMovies(user: User): Promise<{
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
        price: number | null;
    }[]>;
    findOne(id: string): Promise<{
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
        price: number | null;
    }>;
    getTrailerUrl(id: string): Promise<{
        streamUrl: string;
        embedUrl: string;
    } | null>;
    getStreamUrl(id: string): Promise<{
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
        price: number | null;
    } & {
        streamUrl: string;
    }>;
    incrementView(id: string): Promise<{
        success: boolean;
    }>;
}
