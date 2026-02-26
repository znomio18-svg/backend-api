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
    } & {
        streamUrl: string;
    }>;
    incrementView(id: string): Promise<{
        success: boolean;
    }>;
}
