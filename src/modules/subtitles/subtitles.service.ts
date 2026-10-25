import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import { RedisService } from '../../config/redis.service';
import { BunnyService } from '../movies/bunny.service';
import { MoviesService } from '../movies/movies.service';
import { SubtitleFormatError, convertToWebVtt, parseSubtitles, toWebVtt, MAX_SUBTITLE_BYTES } from './subtitle-format';
import { FatalTranslateError, MAX_TRANSLATE_CUES, TranslateBatchFn, translateCues } from './subtitle-translate';
import { DEFAULT_TRANSLATE_MODEL, createClaudeBatchTranslator } from './subtitle-claude';

export interface SubtitleItem {
  srclang: string;
  label: string;
  url: string;
}

export type TranslateJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface TranslateJob {
  status: TranslateJobStatus;
  progress: number;
  cues?: number;
  result?: string;
  error?: string;
}

interface StoredJob extends TranslateJob {
  adminId: string;
  createdAt: number;
  updatedAt: number;
}

const JOB_TTL = 24 * 60 * 60;
/** A queued/running job not updated for this long (and not running here) is treated as lost. */
const STALE_MS = 20 * 60 * 1000;
const CAPTION_URL_TTL = 6 * 60 * 60;

@Injectable()
export class SubtitlesService {
  private readonly logger = new Logger(SubtitlesService.name);
  private readonly streamApiKey: string;
  private readonly anthropicKey: string;
  private readonly model: string;
  /** Jobs running in this process (authoritative here; Redis shares state across replicas). */
  private readonly localJobs = new Map<string, StoredJob>();
  /** Test seam: replaces the Claude caller. */
  translatorOverride?: TranslateBatchFn;

  constructor(
    config: ConfigService,
    private readonly bunny: BunnyService,
    private readonly movies: MoviesService,
    private readonly redis: RedisService,
  ) {
    this.streamApiKey = config.get<string>('BUNNY_STREAM_API_KEY') || '';
    this.anthropicKey = config.get<string>('ANTHROPIC_API_KEY') || '';
    this.model = config.get<string>('SUBTITLE_TRANSLATE_MODEL') || DEFAULT_TRANSLATE_MODEL;
  }

  // ---------------------------------------------------------------- Bunny captions

  private requireStream(): { libraryId: string; key: string } {
    const libraryId = this.bunny.getLibraryId();
    if (!this.streamApiKey || !libraryId) {
      throw new ServiceUnavailableException(
        'Bunny Stream API key тохируулаагүй (BUNNY_STREAM_API_KEY). Серверийн тохиргоонд нэмсний дараа дахин оролдоно уу.',
      );
    }
    return { libraryId, key: this.streamApiKey };
  }

  private async videoIdFor(movieId: string): Promise<string> {
    const movie = await this.movies.findOne(movieId);
    if (!movie.videoId) {
      throw new BadRequestException('Энэ кинонд үндсэн видео (Bunny video ID) холбогдоогүй байна. Эхлээд видеогоо оруулна уу.');
    }
    return movie.videoId;
  }

  private bunnyError(err: unknown, action: string): never {
    const ax = err as AxiosError<any>;
    const status = ax?.response?.status;
    this.logger.warn(`Bunny captions ${action} failed: ${status ?? ''} ${ax?.message ?? err}`);
    if (status === 401 || status === 403) {
      throw new BadGatewayException('Bunny Stream API key буруу байна (BUNNY_STREAM_API_KEY). Library-ийн API key-г шалгана уу.');
    }
    if (status === 404) {
      throw new NotFoundException('Bunny дээр энэ видео олдсонгүй. Киноны Video ID зөв эсэхийг шалгана уу.');
    }
    throw new BadGatewayException(`Bunny Stream-тэй холбогдоход алдаа гарлаа (${status ?? 'сүлжээ'}). Хэсэг хугацааны дараа дахин оролдоно уу.`);
  }

  async list(movieId: string): Promise<{ items: SubtitleItem[] }> {
    const { libraryId, key } = this.requireStream();
    const videoId = await this.videoIdFor(movieId);
    try {
      const { data } = await axios.get(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
        headers: { AccessKey: key, accept: 'application/json' },
        timeout: 15000,
      });
      const captions: Array<{ srclang?: string; label?: string }> = Array.isArray(data?.captions) ? data.captions : [];
      return {
        items: captions
          .filter((c) => c?.srclang)
          .map((c) => ({
            srclang: String(c.srclang),
            label: c.label ? String(c.label) : String(c.srclang),
            url: this.bunny.generateSignedFileUrl(videoId, `captions/${c.srclang}.vtt`, CAPTION_URL_TTL),
          })),
      };
    } catch (err) {
      this.bunnyError(err, 'list');
    }
  }

  async upload(movieId: string, srclang: string, label: string, content: string): Promise<{ items: SubtitleItem[] }> {
    const { libraryId, key } = this.requireStream();
    let vtt: string;
    try {
      vtt = convertToWebVtt(content).vtt;
    } catch (err) {
      if (err instanceof SubtitleFormatError) throw new BadRequestException(err.message);
      throw err;
    }
    const videoId = await this.videoIdFor(movieId);
    const lang = srclang.toLowerCase();
    try {
      await axios.post(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/captions/${encodeURIComponent(lang)}`,
        { srclang: lang, label, captionsFile: Buffer.from(vtt, 'utf8').toString('base64') },
        { headers: { AccessKey: key, 'content-type': 'application/json' }, timeout: 25000, maxBodyLength: 20 * 1024 * 1024 },
      );
    } catch (err) {
      this.bunnyError(err, 'upload');
    }
    return this.list(movieId);
  }

  async remove(movieId: string, srclang: string): Promise<{ items: SubtitleItem[] }> {
    const { libraryId, key } = this.requireStream();
    const videoId = await this.videoIdFor(movieId);
    try {
      await axios.delete(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/captions/${encodeURIComponent(srclang.toLowerCase())}`,
        { headers: { AccessKey: key }, timeout: 15000 },
      );
    } catch (err) {
      // Already gone → treat as success
      if ((err as AxiosError)?.response?.status !== 404) this.bunnyError(err, 'delete');
    }
    return this.list(movieId);
  }

  // ---------------------------------------------------------------- Translation jobs

  private jobKey(jobId: string) {
    return `subtitle:translate:job:${jobId}`;
  }
  private adminKey(adminId: string) {
    return `subtitle:translate:admin:${adminId}`;
  }

  private async saveJob(jobId: string, job: StoredJob): Promise<void> {
    job.updatedAt = Date.now();
    if (job.status === 'queued' || job.status === 'running') this.localJobs.set(jobId, job);
    else this.localJobs.delete(jobId);
    await this.redis.setJson(this.jobKey(jobId), job, JOB_TTL);
  }

  private async loadJob(jobId: string): Promise<StoredJob | null> {
    return this.localJobs.get(jobId) ?? (await this.redis.getJson<StoredJob>(this.jobKey(jobId)));
  }

  private isActive(jobId: string, job: StoredJob | null): boolean {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return false;
    return this.localJobs.has(jobId) || Date.now() - job.updatedAt < STALE_MS;
  }

  async startTranslation(
    adminId: string,
    content: string,
    sourceLang: string | undefined,
    targetLang: string,
  ): Promise<{ jobId: string }> {
    if (!this.anthropicKey && !this.translatorOverride) {
      throw new ServiceUnavailableException(
        'AI орчуулга идэвхгүй байна: ANTHROPIC_API_KEY тохируулаагүй. Серверийн тохиргоонд нэмсний дараа дахин оролдоно уу.',
      );
    }
    if (Buffer.byteLength(content ?? '', 'utf8') > MAX_SUBTITLE_BYTES) {
      throw new BadRequestException('Хадмалын файл 5 MB-аас их байна. Жижиг файл ашиглана уу.');
    }
    const cues = parseSubtitles(content ?? '');
    if (!cues.length) {
      throw new BadRequestException(
        'Хадмалаас нэг ч мөр уншиж чадсангүй. Файл .srt эсвэл .vtt форматтай эсэхийг шалгана уу.',
      );
    }
    if (cues.length > MAX_TRANSLATE_CUES) {
      throw new BadRequestException(
        `Хадмал хэт урт байна (${cues.length} мөр). Нэг удаад ${MAX_TRANSLATE_CUES} хүртэл мөр орчуулна — файлаа хувааж оруулна уу.`,
      );
    }

    const runningId = await this.redis.get(this.adminKey(adminId));
    const localRunning = [...this.localJobs.entries()].find(([, j]) => j.adminId === adminId);
    const candidateId = localRunning?.[0] ?? runningId;
    if (candidateId && this.isActive(candidateId, await this.loadJob(candidateId))) {
      throw new ConflictException('Таны өмнөх орчуулга дуусаагүй байна. Түүнийг дуустал хүлээгээд дахин оролдоно уу.');
    }

    const jobId = randomUUID();
    const now = Date.now();
    const job: StoredJob = { status: 'queued', progress: 0, cues: cues.length, adminId, createdAt: now, updatedAt: now };
    await this.saveJob(jobId, job);
    await this.redis.set(this.adminKey(adminId), jobId, JOB_TTL);

    const source = sourceLang && sourceLang !== 'auto' ? sourceLang : undefined;
    const translator = this.translatorOverride ?? createClaudeBatchTranslator(this.anthropicKey, this.model);

    // Background: the request returns immediately (30 s global timeout).
    void (async () => {
      try {
        job.status = 'running';
        await this.saveJob(jobId, job);
        const translated = await translateCues(cues, translator, {
          sourceLang: source,
          targetLang,
          onProgress: async (done, total) => {
            job.progress = Math.min(0.99, done / total);
            await this.saveJob(jobId, job);
          },
        });
        job.status = 'done';
        job.progress = 1;
        job.result = toWebVtt(translated);
        await this.saveJob(jobId, job);
        this.logger.log(`Subtitle translation ${jobId} done (${cues.length} cues, model ${this.model})`);
      } catch (err: any) {
        this.logger.warn(`Subtitle translation ${jobId} failed: ${err?.message ?? err}`);
        job.status = 'failed';
        job.error =
          err instanceof FatalTranslateError
            ? err.message
            : 'Орчуулга амжилтгүй боллоо (AI хариу буруу эсвэл түр алдаа). Хэсэг хугацааны дараа дахин оролдоно уу.';
        await this.saveJob(jobId, job);
      } finally {
        if ((await this.redis.get(this.adminKey(adminId))) === jobId) await this.redis.del(this.adminKey(adminId));
      }
    })();

    return { jobId };
  }

  async getJob(jobId: string): Promise<TranslateJob> {
    const job = await this.loadJob(jobId);
    if (!job) throw new NotFoundException('Орчуулгын ажил олдсонгүй (24 цагийн дараа устдаг). Дахин эхлүүлнэ үү.');
    if ((job.status === 'queued' || job.status === 'running') && !this.isActive(jobId, job)) {
      return {
        status: 'failed',
        progress: job.progress,
        cues: job.cues,
        error: 'Сервер дахин эхэлсэн тул орчуулга тасарлаа. Дахин эхлүүлнэ үү.',
      };
    }
    const { status, progress, cues, result, error } = job;
    return { status, progress, cues, ...(result !== undefined ? { result } : {}), ...(error ? { error } : {}) };
  }
}
