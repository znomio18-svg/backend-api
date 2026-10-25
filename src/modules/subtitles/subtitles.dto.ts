import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** BCP-47-ish language code: "mn", "en", "zh", "zh-Hans", "pt-BR" (2–8 chars). */
const LANG_RE = /^(?=.{2,8}$)[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/;
const LANG_MSG = 'Хэлний код буруу байна (жишээ нь mn, en, zh).';
/** 5 MB of UTF-8 is at most ~5.2M chars; exact byte limit is checked in the service. */
const MAX_CONTENT_CHARS = 5_300_000;

export class UploadSubtitleDto {
  @ApiProperty({ example: 'mn' })
  @IsString()
  @Matches(LANG_RE, { message: LANG_MSG })
  srclang: string;

  @ApiProperty({ example: 'Монгол' })
  @IsString()
  @IsNotEmpty({ message: 'Хадмалын нэр (label) хоосон байна.' })
  @MaxLength(50)
  label: string;

  @ApiProperty({ description: 'SRT or WebVTT text' })
  @IsString()
  @IsNotEmpty({ message: 'Хадмалын файл хоосон байна.' })
  @MaxLength(MAX_CONTENT_CHARS, { message: 'Хадмалын файл 5 MB-аас их байна.' })
  content: string;
}

export class TranslateSubtitleDto {
  @ApiProperty({ description: 'SRT or WebVTT text' })
  @IsString()
  @IsNotEmpty({ message: 'Хадмалын файл хоосон байна.' })
  @MaxLength(MAX_CONTENT_CHARS, { message: 'Хадмалын файл 5 MB-аас их байна.' })
  content: string;

  @ApiProperty({ required: false, example: 'zh', description: 'Source language; omit or "auto" to auto-detect' })
  @IsOptional()
  @IsString()
  @Matches(/^(auto|(?=.{2,8}$)[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?)$/, { message: LANG_MSG })
  sourceLang?: string;

  @ApiProperty({ example: 'mn', enum: ['mn'] })
  @IsIn(['mn'], { message: 'Одоогоор зөвхөн монгол (mn) руу орчуулна.' })
  targetLang: 'mn';
}
