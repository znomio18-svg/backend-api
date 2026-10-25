import Anthropic from '@anthropic-ai/sdk';
import { BatchRequest, FatalTranslateError, TranslateBatchFn } from './subtitle-translate';

export const DEFAULT_TRANSLATE_MODEL = 'claude-sonnet-5-5';

/** Models that accept server-side refusal fallback in its `"default"` form. */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

const LANG_NAMES: Record<string, string> = {
  mn: 'Mongolian (Cyrillic script)',
  en: 'English',
  zh: 'Chinese',
  ko: 'Korean',
  ja: 'Japanese',
  ru: 'Russian',
  th: 'Thai',
  vi: 'Vietnamese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  tr: 'Turkish',
};

export function languageName(code?: string): string {
  if (!code || code === 'auto') return 'auto-detect';
  return LANG_NAMES[code.toLowerCase().split('-')[0]] ?? code;
}

const SYSTEM_PROMPT = `You are a professional subtitle translator for short drama series and films shown to a Mongolian audience.

You receive a JSON object with numbered subtitle cues and return their translations into the target language.

Rules:
- Translate only the text. Return every input index "i" exactly once, unchanged, and nothing else.
- Write Mongolian in Cyrillic script, in a natural, spoken drama register: how people in Mongolia actually talk, not literal or bookish phrasing.
- Keep each cue short enough to read on screen: at most 2 lines and roughly 42 characters per line. Use "\\n" for a line break. Condense wording if needed, but keep the meaning.
- One cue in → one cue out. Do not merge or split cues, even when a sentence continues into the next cue.
- Keep simple formatting tags such as <i>…</i> and leading dialogue dashes ("- ") if present.
- Keep character names, places and titles consistent with the glossary. Transliterate names into Mongolian Cyrillic the way Mongolian dubbing usually does.
- Never add translator notes, explanations, romanisation or the original text.
- "context" lines precede this batch and are for understanding only; do not translate them.
- In "names", list person/place names (source spelling → Mongolian spelling) that appear in this batch and are not already in the glossary.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['i', 'text'],
        additionalProperties: false,
      },
    },
    names: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          mn: { type: 'string' },
        },
        required: ['source', 'mn'],
        additionalProperties: false,
      },
    },
  },
  required: ['translations', 'names'],
  additionalProperties: false,
};

export function buildUserMessage(req: BatchRequest): string {
  return JSON.stringify({
    source_language: languageName(req.sourceLang),
    target_language: languageName(req.targetLang),
    glossary: req.glossary,
    context: req.context,
    cues: req.items,
  });
}

/** Creates the batch caller backed by the Claude Messages API. */
export function createClaudeBatchTranslator(apiKey: string, model: string): TranslateBatchFn {
  const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 5 * 60 * 1000 });
  const useFallback = FALLBACK_MODELS.has(model);

  return async (req: BatchRequest) => {
    try {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 32000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(req) }],
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new Error('model declined this batch (refusal)');
      }
      if (message.stop_reason === 'max_tokens') {
        throw new Error('model output was cut off (max_tokens)');
      }
      const text = message.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('');
      return JSON.parse(text);
    } catch (err) {
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError
      ) {
        throw new FatalTranslateError('ANTHROPIC_API_KEY буруу эсвэл эрхгүй байна. Түлхүүрээ шалгана уу.');
      }
      if (err instanceof Anthropic.NotFoundError || err instanceof Anthropic.BadRequestError) {
        throw new FatalTranslateError(`Claude API хүсэлтийг хүлээж авсангүй (${err.status}): ${err.message}`);
      }
      throw err;
    }
  };
}
