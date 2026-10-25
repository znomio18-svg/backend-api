/**
 * SRT / WebVTT parsing and WebVTT serialisation. Pure functions (no Nest
 * dependencies) so they can be unit-tested in isolation.
 */

export interface SubtitleCue {
  /** Normalised WebVTT timestamp, e.g. "00:01:02.345" */
  start: string;
  end: string;
  /** WebVTT cue settings after the end timestamp (VTT input only), e.g. "line:90%" */
  settings?: string;
  /** Cue text; lines separated by "\n" */
  text: string;
}

/** Max accepted subtitle file size (bytes, UTF-8). */
export const MAX_SUBTITLE_BYTES = 5 * 1024 * 1024;

const TIMING_RE =
  /^\s*((?:\d+:)?\d{1,2}:\d{1,2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{1,2}[.,]\d{1,3})(.*)$/;

/** "1:02:03,5" / "02:03.456" → "01:02:03.500" / "00:02:03.456" */
export function normalizeTimestamp(raw: string): string {
  const [clock, fraction = '0'] = raw.trim().split(/[.,]/);
  const parts = clock.split(':').map((p) => parseInt(p, 10));
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  const ms = fraction.padEnd(3, '0').slice(0, 3);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${ms}`;
}

function cleanCueText(lines: string[]): string {
  return lines
    .map((l) =>
      l
        // ASS/SSA override tags that some SRT files carry, e.g. {\an8}
        .replace(/\{\\[^}]*\}/g, '')
        // "-->" inside text would break WebVTT parsing
        .replace(/-->/g, '→')
        .trimEnd(),
    )
    .filter((l) => l.trim().length > 0)
    .join('\n');
}

/**
 * Parse SRT or WebVTT text into cues. Lenient: numeric SRT indexes, VTT cue
 * identifiers, NOTE/STYLE/REGION blocks and the WEBVTT header are skipped;
 * blocks without a timing line and cues with empty text are dropped.
 */
export function parseSubtitles(input: string): SubtitleCue[] {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n[ \t]*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    while (lines.length && lines[0].trim() === '') lines.shift();
    if (!lines.length) continue;
    const head = lines[0].trim();
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(head)) continue;

    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx === -1) continue;
    const match = TIMING_RE.exec(lines[timingIdx]);
    if (!match) continue;

    const cueText = cleanCueText(lines.slice(timingIdx + 1));
    if (!cueText) continue;

    const settings = match[3].trim();
    cues.push({
      start: normalizeTimestamp(match[1]),
      end: normalizeTimestamp(match[2]),
      ...(settings ? { settings } : {}),
      text: cueText,
    });
  }
  return cues;
}

/** Serialise cues as a WebVTT document. */
export function toWebVtt(cues: SubtitleCue[]): string {
  const body = cues
    .map((c, idx) => {
      const timing = `${c.start} --> ${c.end}${c.settings ? ` ${c.settings}` : ''}`;
      return `${idx + 1}\n${timing}\n${cleanCueText(c.text.split('\n'))}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

export class SubtitleFormatError extends Error {}

/**
 * Validate an uploaded SRT/VTT text and convert it to WebVTT.
 * Throws SubtitleFormatError with an admin-readable (Mongolian) message.
 */
export function convertToWebVtt(content: string): { vtt: string; cues: SubtitleCue[] } {
  if (typeof content !== 'string' || !content.trim()) {
    throw new SubtitleFormatError('Хадмалын файл хоосон байна.');
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_SUBTITLE_BYTES) {
    throw new SubtitleFormatError('Хадмалын файл 5 MB-аас их байна. Жижиг файл ашиглана уу.');
  }
  const cues = parseSubtitles(content);
  if (cues.length === 0) {
    throw new SubtitleFormatError(
      'Хадмалаас нэг ч мөр уншиж чадсангүй. Файл .srt эсвэл .vtt форматтай, "00:00:01,000 --> 00:00:03,000" хэлбэрийн хугацаатай эсэхийг шалгана уу.',
    );
  }
  return { vtt: toWebVtt(cues), cues };
}

/** Split an array into consecutive chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
