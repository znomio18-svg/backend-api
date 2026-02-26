import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class BunnyService {
  private readonly logger = new Logger(BunnyService.name);

  // Movie library (protected)
  private readonly libraryId: string;
  private readonly apiKey: string;
  private readonly cdnHostname: string;

  // Trailer library (public)
  private readonly trailerLibraryId: string;
  private readonly trailerCdnHostname: string;

  // Storage zone (images)
  private readonly storageApiKey: string;
  private readonly storageZoneName: string;
  private readonly storageCdnUrl: string;
  private readonly storageHostname: string;

  constructor(private configService: ConfigService) {
    this.libraryId = this.configService.get<string>('BUNNY_LIBRARY_ID') || '';
    this.apiKey = this.configService.get<string>('BUNNY_API_KEY') || '';
    this.cdnHostname =
      this.configService.get<string>('BUNNY_CDN_HOSTNAME') || '';
    this.trailerLibraryId =
      this.configService.get<string>('BUNNY_TRAILER_LIBRARY_ID') || '';
    this.trailerCdnHostname =
      this.configService.get<string>('BUNNY_TRAILER_CDN_HOSTNAME') || '';

    // Storage zone config
    this.storageApiKey =
      this.configService.get<string>('BUNNY_STORAGE_API_KEY') || '';
    this.storageZoneName =
      this.configService.get<string>('BUNNY_STORAGE_ZONE_NAME') || '';
    this.storageCdnUrl =
      this.configService.get<string>('BUNNY_STORAGE_CDN_URL') || '';
    this.storageHostname =
      this.configService.get<string>('BUNNY_STORAGE_HOSTNAME') || 'storage.bunnycdn.com';
  }

  getStreamUrl(videoId: string): string {
    return `https://${this.cdnHostname}/${videoId}/playlist.m3u8`;
  }

  getThumbnailUrl(videoId: string): string {
    return `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`;
  }

  getPreviewUrl(videoId: string): string {
    return `https://${this.cdnHostname}/${videoId}/preview.webp`;
  }

  generateSignedUrl(videoId: string, expiresInSeconds: number = 3600): string {
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

  getEmbedUrl(videoId: string): string {
    return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}`;
  }

  getDirectPlayUrl(videoId: string): string {
    return `https://iframe.mediadelivery.net/play/${this.libraryId}/${videoId}`;
  }

  // Trailer library methods (public, no signing required)
  getTrailerStreamUrl(videoId: string): string {
    return `https://${this.trailerCdnHostname}/${videoId}/playlist.m3u8`;
  }

  getTrailerEmbedUrl(videoId: string): string {
    return `https://iframe.mediadelivery.net/embed/${this.trailerLibraryId}/${videoId}`;
  }

  getTrailerDirectPlayUrl(videoId: string): string {
    return `https://iframe.mediadelivery.net/play/${this.trailerLibraryId}/${videoId}`;
  }

  // Storage zone methods (for images)
  async uploadFile(
    buffer: Buffer,
    filename: string,
    path: string = 'images',
  ): Promise<string> {
    const url = `https://${this.storageHostname}/${this.storageZoneName}/${path}/${filename}`;

    await axios.put(url, buffer, {
      headers: {
        AccessKey: this.storageApiKey,
        'Content-Type': 'application/octet-stream',
      },
    });

    this.logger.log(`Uploaded file to Bunny Storage: ${path}/${filename}`);
    return `${this.storageCdnUrl}/${path}/${filename}`;
  }

  /**
   * Resolve a stored image URL to a full CDN URL.
   * Handles relative paths from old /uploads/ and new /images/ storage.
   */
  resolveImageUrl(url: string): string {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Relative path like "/images/abc.png" or "/uploads/abc.png"
    if (this.storageCdnUrl) {
      return `${this.storageCdnUrl}${url}`;
    }
    return url;
  }

  async deleteFile(path: string): Promise<void> {
    const url = `https://${this.storageHostname}/${this.storageZoneName}/${path}`;

    try {
      await axios.delete(url, {
        headers: { AccessKey: this.storageApiKey },
      });
      this.logger.log(`Deleted file from Bunny Storage: ${path}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file from Bunny Storage: ${path}`);
    }
  }
}
