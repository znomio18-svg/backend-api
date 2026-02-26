import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { BunnyService } from '../movies/bunny.service';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly bunnyService: BunnyService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an image file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filename = `${uuidv4()}${extname(file.originalname)}`;

    try {
      const url = await this.bunnyService.uploadFile(file.buffer, filename);

      return {
        url,
        filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload image: ${error.message}`,
        error.response?.data || error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to upload image: ${error.message}`,
      );
    }
  }
}
