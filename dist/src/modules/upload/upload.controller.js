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
var UploadController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const bunny_service_1 = require("../movies/bunny.service");
const uuid_1 = require("uuid");
const path_1 = require("path");
let UploadController = UploadController_1 = class UploadController {
    constructor(bunnyService) {
        this.bunnyService = bunnyService;
        this.logger = new common_1.Logger(UploadController_1.name);
    }
    async uploadImage(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const filename = `${(0, uuid_1.v4)()}${(0, path_1.extname)(file.originalname)}`;
        try {
            const url = await this.bunnyService.uploadFile(file.buffer, filename);
            return {
                url,
                filename,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
            };
        }
        catch (error) {
            this.logger.error(`Failed to upload image: ${error.message}`, error.response?.data || error.stack);
            throw new common_1.InternalServerErrorException(`Failed to upload image: ${error.message}`);
        }
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)('image'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({ summary: 'Upload an image file' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadImage", null);
exports.UploadController = UploadController = UploadController_1 = __decorate([
    (0, swagger_1.ApiTags)('Upload'),
    (0, common_1.Controller)('upload'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'), roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [bunny_service_1.BunnyService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map