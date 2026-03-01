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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoviesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const movies_service_1 = require("./movies.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const subscription_guard_1 = require("../../common/guards/subscription.guard");
let MoviesController = class MoviesController {
    constructor(moviesService) {
        this.moviesService = moviesService;
    }
    async findAll(query) {
        return this.moviesService.findAll({
            ...query,
            isPublished: true,
        });
    }
    async getFeatured() {
        return this.moviesService.getFeaturedMovies();
    }
    async getPurchasedMovies(user) {
        return this.moviesService.getUserPurchasedMovies(user.id);
    }
    async findOne(id) {
        return this.moviesService.findOne(id);
    }
    async getTrailerUrl(id) {
        return this.moviesService.getTrailerUrls(id);
    }
    async getStreamUrl(id) {
        return this.moviesService.getMovieWithStreamUrl(id);
    }
    async incrementView(id) {
        await this.moviesService.incrementViewCount(id);
        return { success: true };
    }
};
exports.MoviesController = MoviesController;
__decorate([
    (0, common_1.Get)(),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all published movies with pagination' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }),
    (0, swagger_1.ApiQuery)({ name: 'featured', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'sortBy', required: false, enum: ['createdAt', 'title', 'rating', 'viewCount'] }),
    (0, swagger_1.ApiQuery)({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('featured'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get featured movies' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "getFeatured", null);
__decorate([
    (0, common_1.Get)('purchased'),
    (0, swagger_1.ApiOperation)({ summary: 'Get movies purchased by the current user' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "getPurchasedMovies", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get movie details (metadata only, no stream URL)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/trailer'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get movie trailer URL (public)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "getTrailerUrl", null);
__decorate([
    (0, common_1.Get)(':id/stream'),
    (0, common_1.UseGuards)(subscription_guard_1.SubscriptionGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get movie stream URL (requires subscription or movie purchase)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "getStreamUrl", null);
__decorate([
    (0, common_1.Post)(':id/view'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Increment movie view count' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MoviesController.prototype, "incrementView", null);
exports.MoviesController = MoviesController = __decorate([
    (0, swagger_1.ApiTags)('Movies'),
    (0, common_1.Controller)('movies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [movies_service_1.MoviesService])
], MoviesController);
//# sourceMappingURL=movies.controller.js.map