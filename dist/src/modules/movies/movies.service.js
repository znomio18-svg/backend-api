"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoviesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma.service");
const redis_service_1 = require("../../config/redis.service");
const bunny_service_1 = require("./bunny.service");
let MoviesService = class MoviesService {
    constructor(prisma, redis, bunnyService) {
        this.prisma = prisma;
        this.redis = redis;
        this.bunnyService = bunnyService;
    }
    async create(data) {
        const movie = await this.prisma.movie.create({
            data,
        });
        await this.redis.flushPattern('movies:*');
        return movie;
    }
    async findAll(params) {
        const { page: rawPage = 1, limit: rawLimit = 12, search, featured, sortBy = 'createdAt', sortOrder = 'desc', isPublished, } = params;
        const page = Number(rawPage);
        const limit = Number(rawLimit);
        const skip = (page - 1) * limit;
        const where = {};
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
        const orderBy = {
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
    async findOne(id) {
        const cached = await this.redis.getJson(`movie:${id}`);
        if (cached)
            return this.resolveMovieUrls(cached);
        const movie = await this.prisma.movie.findUnique({
            where: { id },
        });
        if (!movie) {
            throw new common_1.NotFoundException('Movie not found');
        }
        await this.redis.setJson(`movie:${id}`, movie, 300);
        return this.resolveMovieUrls(movie);
    }
    async update(id, data) {
        const movie = await this.prisma.movie.update({
            where: { id },
            data,
        });
        await this.redis.del(`movie:${id}`);
        await this.redis.flushPattern('movies:*');
        return movie;
    }
    async delete(id) {
        await this.prisma.movie.delete({
            where: { id },
        });
        await this.redis.del(`movie:${id}`);
        await this.redis.flushPattern('movies:*');
    }
    async getMovieWithStreamUrl(movieId) {
        const movie = await this.findOne(movieId);
        const streamUrl = this.bunnyService.generateSignedUrl(movie.videoId, 14400);
        return { ...movie, streamUrl };
    }
    async incrementViewCount(id) {
        await this.prisma.movie.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });
    }
    async getFeaturedMovies() {
        const cached = await this.redis.getJson('movies:featured');
        if (cached)
            return cached.map((m) => this.resolveMovieUrls(m));
        const movies = await this.prisma.movie.findMany({
            where: { isPublished: true, isFeatured: true },
            orderBy: { createdAt: 'desc' },
        });
        await this.redis.setJson('movies:featured', movies, 300);
        return movies.map((m) => this.resolveMovieUrls(m));
    }
    async getTrailerUrls(movieId) {
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
    resolveMovieUrls(movie) {
        return {
            ...movie,
            thumbnailUrl: this.bunnyService.resolveImageUrl(movie.thumbnailUrl),
        };
    }
};
exports.MoviesService = MoviesService;
exports.MoviesService = MoviesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        bunny_service_1.BunnyService])
], MoviesService);
//# sourceMappingURL=movies.service.js.map