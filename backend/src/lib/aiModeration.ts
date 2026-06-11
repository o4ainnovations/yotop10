import crypto from 'crypto';
import { SystemConfig } from '../models/SystemConfig';
import { getConfig } from './systemConfig';

const ALGO = 'aes-256-gcm';
const KEY = process.env.CONFIG_ENCRYPTION_KEY;
if (!KEY || KEY.length < 32) {
  console.warn('[aiModeration] CONFIG_ENCRYPTION_KEY not set or too short — AI moderation disabled');
}

function deriveKey(seed: string): Buffer {
  return crypto.createHash('sha256').update(seed).digest();
}

export function encrypt(text: string): string {
  const key = deriveKey(KEY || 'fallback-insecure-key-do-not-use');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encoded: string): string {
  const key = deriveKey(KEY || 'fallback-insecure-key-do-not-use');
  const [ivHex, tagHex, dataHex] = encoded.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted format');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}

export interface AiModerationConfig {
  api_key: string;
  model: string;
  temperature: number;
  auto_approve_threshold: number;
  enabled: boolean;
}

export interface AiModerationResult {
  score: number;
  flags: string[];
  model: string;
  prompt_tokens: number;
}

export async function getAiConfig(): Promise<AiModerationConfig | null> {
  try {
    const doc = await SystemConfig.findOne({ key: 'global' }).lean();
    if (!doc) return null;
    const ai = (doc as any).ai_moderation;
    if (!ai || !ai.api_key_encrypted || !ai.enabled) return null;
    return {
      api_key: decrypt(ai.api_key_encrypted),
      model: ai.model || 'deepseek-chat',
      temperature: ai.temperature ?? 0.1,
      auto_approve_threshold: ai.auto_approve_threshold ?? 80,
      enabled: ai.enabled,
    };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a content quality analyzer. Analyze this post and return ONLY valid JSON. No markdown, no explanation.

{"score": <integer 0-100>, "flags": ["<issue>"]}

HIGH QUALITY (80-100): substantive content, well-structured, clear justification for each item, proper length, original viewpoint.
MODERATE QUALITY (40-79): some substance but issues like short entries, weak justification, minimal context, formatting problems.
LOW QUALITY (0-39): gibberish, spam, excessive capitalization, repeated characters, nonsensical text, very minimal content, no coherent argument.

Flags (pick only relevant ones): thin_content, gibberish, excessive_caps, spam_patterns, short_items, weak_justification, no_structure, low_effort`;

export async function analyzePost(
  title: string,
  postType: string,
  intro: string,
  itemsSummary: string,
  config: AiModerationConfig,
): Promise<AiModerationResult> {
  const userMessage = `Title: ${title}\nType: ${postType}\nIntro: ${intro}\nItems: ${itemsSummary}`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: config.temperature ?? 0.1,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number };
  };

  const rawContent = data.choices?.[0]?.message?.content || '{}';
  const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { score?: number; flags?: string[] };

  return {
    score: Math.max(0, Math.min(100, parsed.score ?? 0)),
    flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 10) : [],
    model: config.model,
    prompt_tokens: data.usage?.prompt_tokens || 0,
  };
}
