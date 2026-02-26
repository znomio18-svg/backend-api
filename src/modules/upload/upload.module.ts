import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { UploadController } from './upload.controller';
import { MoviesModule } from '../movies/movies.module';

@Module({
  imports: [
    MoviesModule,
    MulterModule.register({
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = extname(file.originalname).toLowerCase().slice(1);
        const mimeType = file.mimetype.split('/')[1];

        if (allowedTypes.test(ext) && allowedTypes.test(mimeType)) {
          callback(null, true);
        } else {
          callback(new Error('Only image files are allowed'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
