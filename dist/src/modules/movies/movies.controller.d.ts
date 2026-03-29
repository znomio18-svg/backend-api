import { User } from '@prisma/client';
import { MoviesService, MovieListParams } from './movies.service';
export declare class MoviesController {
    private moviesService;
    constructor(moviesService: MoviesService);
    findAll(query: MovieListParams & {
        category?: string;
    }): Promise<{
        movies: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            title: string;
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
            category: import(".prisma/client").$Enums.MovieCategory;
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
        description: string;
        title: string;
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
        category: import(".prisma/client").$Enums.MovieCategory;
    }[]>;
    getPurchasedMovies(user: User): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
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
        category: import(".prisma/client").$Enums.MovieCategory;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
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
        category: import(".prisma/client").$Enums.MovieCategory;
    }>;
    getTrailerUrl(id: string): Promise<{
        streamUrl: string;
        embedUrl: string;
    } | null>;
    getStreamUrl(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
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
        category: import(".prisma/client").$Enums.MovieCategory;
    } & {
        streamUrl: string;
    }>;
    incrementView(id: string): Promise<{
        success: boolean;
    }>;
}
