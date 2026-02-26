import { BunnyService } from '../movies/bunny.service';
export declare class UploadController {
    private readonly bunnyService;
    private readonly logger;
    constructor(bunnyService: BunnyService);
    uploadImage(file: Express.Multer.File): Promise<{
        url: string;
        filename: string;
        originalName: string;
        size: number;
        mimeType: string;
    }>;
}
