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
var BunnyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BunnyService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
const axios_1 = require("axios");
let BunnyService = BunnyService_1 = class BunnyService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(BunnyService_1.name);
        this.libraryId = this.configService.get('BUNNY_LIBRARY_ID') || '';
        this.apiKey = this.configService.get('BUNNY_API_KEY') || '';
        this.cdnHostname =
            this.configService.get('BUNNY_CDN_HOSTNAME') || '';
        this.trailerLibraryId =
            this.configService.get('BUNNY_TRAILER_LIBRARY_ID') || '';
        this.trailerCdnHostname =
            this.configService.get('BUNNY_TRAILER_CDN_HOSTNAME') || '';
        this.storageApiKey =
            this.configService.get('BUNNY_STORAGE_API_KEY') || '';
        this.storageZoneName =
            this.configService.get('BUNNY_STORAGE_ZONE_NAME') || '';
        this.storageCdnUrl =
            this.configService.get('BUNNY_STORAGE_CDN_URL') || '';
        this.storageHostname =
            this.configService.get('BUNNY_STORAGE_HOSTNAME') || 'storage.bunnycdn.com';
    }
    getStreamUrl(videoId) {
        return `https://${this.cdnHostname}/${videoId}/playlist.m3u8`;
    }
    getThumbnailUrl(videoId) {
        return `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`;
    }
    getPreviewUrl(videoId) {
        return `https://${this.cdnHostname}/${videoId}/preview.webp`;
    }
    generateSignedUrl(videoId, expiresInSeconds = 3600) {
        const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
        const path = `/${videoId}/playlist.m3u8`;
        const hashableBase = this.apiKey + path + expires.toString();
        const token = crypto
            .createHash('sha256')
            .update(hashableBase)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        return `https://${this.cdnHostname}${path}?token=${token}&expires=${expires}`;
    }
    getEmbedUrl(videoId) {
        return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}`;
    }
    getDirectPlayUrl(videoId) {
        return `https://iframe.mediadelivery.net/play/${this.libraryId}/${videoId}`;
    }
    getTrailerStreamUrl(videoId) {
        return `https://${this.trailerCdnHostname}/${videoId}/playlist.m3u8`;
    }
    getTrailerEmbedUrl(videoId) {
        return `https://iframe.mediadelivery.net/embed/${this.trailerLibraryId}/${videoId}`;
    }
    getTrailerDirectPlayUrl(videoId) {
        return `https://iframe.mediadelivery.net/play/${this.trailerLibraryId}/${videoId}`;
    }
    async uploadFile(buffer, filename, path = 'images') {
        const url = `https://${this.storageHostname}/${this.storageZoneName}/${path}/${filename}`;
        await axios_1.default.put(url, buffer, {
            headers: {
                AccessKey: this.storageApiKey,
                'Content-Type': 'application/octet-stream',
            },
        });
        this.logger.log(`Uploaded file to Bunny Storage: ${path}/${filename}`);
        return `${this.storageCdnUrl}/${path}/${filename}`;
    }
    resolveImageUrl(url) {
        if (!url)
            return url;
        if (url.startsWith('http://') || url.startsWith('https://'))
            return url;
        if (this.storageCdnUrl) {
            return `${this.storageCdnUrl}${url}`;
        }
        return url;
    }
    async deleteFile(path) {
        const url = `https://${this.storageHostname}/${this.storageZoneName}/${path}`;
        try {
            await axios_1.default.delete(url, {
                headers: { AccessKey: this.storageApiKey },
            });
            this.logger.log(`Deleted file from Bunny Storage: ${path}`);
        }
        catch (error) {
            this.logger.warn(`Failed to delete file from Bunny Storage: ${path}`);
        }
    }
};
exports.BunnyService = BunnyService;
exports.BunnyService = BunnyService = BunnyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BunnyService);
//# sourceMappingURL=bunny.service.js.map