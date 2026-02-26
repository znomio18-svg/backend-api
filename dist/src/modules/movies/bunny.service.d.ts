import { ConfigService } from '@nestjs/config';
export declare class BunnyService {
    private configService;
    private readonly logger;
    private readonly libraryId;
    private readonly apiKey;
    private readonly cdnHostname;
    private readonly trailerLibraryId;
    private readonly trailerCdnHostname;
    private readonly storageApiKey;
    private readonly storageZoneName;
    private readonly storageCdnUrl;
    private readonly storageHostname;
    constructor(configService: ConfigService);
    getStreamUrl(videoId: string): string;
    getThumbnailUrl(videoId: string): string;
    getPreviewUrl(videoId: string): string;
    generateSignedUrl(videoId: string, expiresInSeconds?: number): string;
    getEmbedUrl(videoId: string): string;
    getDirectPlayUrl(videoId: string): string;
    getTrailerStreamUrl(videoId: string): string;
    getTrailerEmbedUrl(videoId: string): string;
    getTrailerDirectPlayUrl(videoId: string): string;
    uploadFile(buffer: Buffer, filename: string, path?: string): Promise<string>;
    resolveImageUrl(url: string): string;
    deleteFile(path: string): Promise<void>;
}
