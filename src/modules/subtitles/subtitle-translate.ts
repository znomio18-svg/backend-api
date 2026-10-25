/**
 * Batch orchestration for subtitle translation. The model call itself is
 * injected (`TranslateBatchFn`) so batching, validation and retries can be
 * unit-tested without network access.
 */
import { SubtitleCue, chunk } from './subtitle-format';

export const BATCH_SIZE = 120;
export const BATCH_CONCURRENCY = 2;
export const MAX_TRANSLATE_CUES = 6000;
const MAX_GLOSSARY = 200;
const CONTEXT_CUES = 5;

export interface BatchItem {
  i: number;
  text: string;
}

export interface GlossaryEntry {
  source: string;
  mn: string;
}

export interface BatchRequest {
  sourceLang?: string;
  targetLang: string;
  items: BatchItem[];
  /** Preceding source lines, for context only (not to be translated). */
  context: string[];
  glossary: GlossaryEntry[];
}

/** Raw model output (already JSON-parsed, still untrusted). */
export type TranslateBatchFn = (req: BatchRequest) => Promise<unknown>;

export class BatchValidationError extends Error {}

/** Max 2 lines per cue; extra lines are merged into the second one. */
export function normalizeTranslatedText(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/-->/g, '→').trim())
    .filter(Boolean);
  if (lines.length <= 2) return lines.join('\n');
  return `${lines[0]}\n${lines.slice(1).join(' ')}`;
}

/**
 * Check a model response against the batch: every requested index exactly
 * once, no unknown indexes, non-empty string texts. Returns i → text.
 */
export function validateBatchResponse(
  items: BatchItem[],
  raw: unknown,
): { texts: Map<number, string>; names: GlossaryEntry[] } {
  if (!raw || typeof raw !== 'object') throw new BatchValidationError('response is not an object');
  const { translations, names } = raw as { translations?: unknown; names?: unknown };
  if (!Array.isArray(translations)) throw new BatchValidationError('translations is not an array');

  const expected = new Set(items.map((it) => it.i));
  const texts = new Map<number, string>();
  for (const entry of translations) {
    if (!entry || typeof entry !== 'object') throw new BatchValidationError('translation entry is not an object');
    const { i, text } = entry as { i?: unknown; text?: unknown };
    if (typeof i !== 'number' || !Number.isInteger(i)) throw new BatchValidationError('index is not an integer');
    if (!expected.has(i)) throw new BatchValidationError(`unexpected index ${i}`);
    if (texts.has(i)) throw new BatchValidationError(`duplicate index ${i}`);
    if (typeof text !== 'string' || !text.trim()) throw new BatchValidationError(`empty text for index ${i}`);
    texts.set(i, normalizeTranslatedText(text));
  }
  if (texts.size !== expected.size) {
    const missing = [...expected].filter((i) => !texts.has(i));
    throw new BatchValidationError(`missing indexes ${missing.slice(0, 10).join(',')}`);
  }

  const glossary: GlossaryEntry[] = [];
  if (Array.isArray(names)) {
    for (const n of names) {
      const { source, mn } = (n ?? {}) as { source?: unknown; mn?: unknown };
      if (typeof source === 'string' && typeof mn === 'string' && source.trim() && mn.trim()) {
        glossary.push({ source: source.trim().slice(0, 80), mn: mn.trim().slice(0, 80) });
      }
    }
  }
  return { texts, names: glossary };
}

export interface TranslateOptions {
  sourceLang?: string;
  targetLang: string;
  batchSize?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void | Promise<void>;
}

/**
 * Translate cue texts batch by batch (timings untouched). The first batch runs
 * alone so its names seed the glossary; the rest run `concurrency` at a time.
 * A batch whose response fails validation (or whose call throws) is retried
 * once; a second failure rejects the whole run.
 */
export async function translateCues(
  cues: SubtitleCue[],
  callBatch: TranslateBatchFn,
  opts: TranslateOptions,
): Promise<SubtitleCue[]> {
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const concurrency = Math.max(1, opts.concurrency ?? BATCH_CONCURRENCY);
  const indexed: BatchItem[] = cues.map((c, i) => ({ i, text: c.text }));
  const batches = chunk(indexed, batchSize);
  const result = new Map<number, string>();
  const glossary = new Map<string, string>();
  let done = 0;

  const runBatch = async (items: BatchItem[]) => {
    const first = items[0].i;
    const context = cues.slice(Math.max(0, first - CONTEXT_CUES), first).map((c) => c.text);
    const req: BatchRequest = {
      sourceLang: opts.sourceLang,
      targetLang: opts.targetLang,
      items,
      context,
      glossary: [...glossary.entries()].map(([source, mn]) => ({ source, mn })),
    };
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callBatch(req);
        const { texts, names } = validateBatchResponse(items, raw);
        texts.forEach((t, i) => result.set(i, t));
        for (const n of names) {
          if (glossary.size >= MAX_GLOSSARY) break;
          if (!glossary.has(n.source)) glossary.set(n.source, n.mn);
        }
        done++;
        await opts.onProgress?.(done, batches.length);
        return;
      } catch (err) {
        lastError = err;
        if (isFatal(err)) break;
      }
    }
    throw lastError;
  };

  if (batches.length) await runBatch(batches[0]);
  let next = 1;
  let failed = false;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(0, batches.length - 1)) }, async () => {
    while (!failed && next < batches.length) {
      const b = batches[next++];
      try {
        await runBatch(b);
      } catch (err) {
        failed = true; // stop the other worker from starting new batches
        throw err;
      }
    }
  });
  await Promise.all(workers);

  return cues.map((c, i) => ({ ...c, text: result.get(i) ?? c.text }));
}

/** Errors that must not be retried (e.g. bad API key). Marked by the caller. */
export class FatalTranslateError extends Error {}
function isFatal(err: unknown): boolean {
  return err instanceof FatalTranslateError;
}
