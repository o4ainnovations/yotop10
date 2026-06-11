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

function buildPrompt(postType: string): string {
  const base = `You are a content quality analyzer for YoTop10. Analyze this ${postType} post and return ONLY valid JSON. No markdown, no explanation.

{"score": <integer 0-100>, "flags": ["<issue>"]}

SCORING RUBRIC:
`;

  const rubrics: Record<string, string> = {
    top_list: `TOP LIST (ranked items with justifications):
- 80-100: Strong intro contextualizing the list. Each item has substantive justification (2+ sentences). Logical ranking order. No filler items. Original perspective.
- 40-79: Some items have weak justifications (1 sentence or vague). Intro is minimal. A few filler items. Ranking feels arbitrary in places.
- 0-39: Most items lack justification. Gibberish/spam. Very short. No coherent ranking logic. Excessive caps or repeated characters.

Flags: thin_content, gibberish, excessive_caps, spam_patterns, short_items, weak_justification, no_structure, low_effort`,

    best_of: `BEST OF (curated positive picks):
- 80-100: Title starts with "Best". Strong justification for why each item is the best. Intro explains the curation criteria. Items feel carefully selected.
- 40-79: Some picks feel generic. Justifications are thin. Title format may be incorrect. Missing "of" in title.
- 0-39: Spam or gibberish. No real justifications. Items don't fit "best of" theme.

Flags: thin_content, gibberish, spam_patterns, wrong_title_format, weak_justification, no_structure`,

    worst_of: `WORST OF (negative critique):
- 80-100: Title starts with "Worst". Clear reasoning why each item is bad (specific criticism, not just insults). Intro sets context. Items are well-known offenders.
- 40-79: Criticism is vague or generic. Some picks are questionable. Title format may be incorrect.
- 0-39: Just insulting with no substance. Gibberish. Title missing "Worst" or "of".

Flags: thin_content, gibberish, spam_patterns, wrong_title_format, weak_justification, no_structure`,

    this_vs_that: `DEBATE (two sides compared):
- 80-100: Both sides are well-defined with clear, distinct descriptions. Arguments for each side are substantive. Title clearly frames the debate. Source URLs add credibility.
- 40-79: One side is weaker than the other. Arguments are generic or one-sided. Title is vague.
- 0-39: Missing one side entirely. Gibberish. Both sides say the same thing. Spam detection.

IMPORTANT: EXACTLY 2 items is CORRECT. Do NOT flag "short_items" — debates have exactly 2 options by design.

Flags: gibberish, spam_patterns, one_sided_unbalanced, vague_title, low_effort`,

    fact_drop: `FACT (single surprising fact):
- 80-100: Fact is genuinely surprising/interesting. Explanation provides context and detail. Source URL is credible and relevant. Clear and well-written.
- 40-79: Fact is common knowledge or uninteresting. Explanation is minimal. Source is missing or weak.
- 0-39: Gibberish or false information. No source. Extremely short with no explanation.

IMPORTANT: EXACTLY 1 item is CORRECT. Short length is EXPECTED for fact drops. Do NOT penalize for brevity.

Flags: thin_content, gibberish, spam_patterns, missing_source, uninteresting_fact`,

    counter_list: `COUNTER LIST (rebuttal to another list):
- 80-100: Clearly addresses and improves upon the original. Items are well-justified. Shows why the counter position is better. Strong intro.
- 40-79: Rebuttal is weak. Items overlap too much with original. Justifications are generic.
- 0-39: No clear connection to parent list. Gibberish. Just a copy of the original.

Flags: thin_content, gibberish, spam_patterns, weak_justification, no_original_rebuttal`,

    article: `ARTICLE (long-form content):
- 80-100: Well-structured with clear paragraphs. Substantial body (>500 chars). Sources cited. Original insight or well-researched. Proper grammar and formatting.
- 40-79: Some structure but could be deeper. Minimal sources. Body could be longer. Some grammatical issues.
- 0-39: Very short body. No structure. Gibberish. No sources. Spam.

Flags: thin_content, gibberish, spam_patterns, no_structure, missing_sources, too_short`,

    hidden_gems: `HIDDEN GEMS (underrated picks):
- 80-100: Items are genuinely obscure/underrated. Justifications explain why they deserve more recognition. Intro sets the theme.
- 40-79: Some picks are too obvious/mainstream. Justifications are weak.
- 0-39: All items are well-known. Spam. No real justifications.

Flags: thin_content, gibberish, spam_patterns, weak_justification, not_actually_underrated`,
  };

  const rubric = rubrics[postType] || rubrics.top_list;
  return base + rubric + '\n\nEvaluate the post and return ONLY valid JSON. Score must be 0-100. Flags must be a (possibly empty) array of strings. You MUST include a "score" field. Never omit it.';
}

async function callDeepSeek(
  prompt: string,
  userMessage: string,
  config: AiModerationConfig,
): Promise<{ raw: string; tokens: number }> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
      temperature: config.temperature ?? 0.1,
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

  const rawContent = data.choices?.[0]?.message?.content || '';
  return { raw: rawContent, tokens: data.usage?.prompt_tokens || 0 };
}

function parseScore(rawContent: string): { score: number; flags: string[] } | null {
  const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(cleaned); } catch { return null; }

  const score = parsed.score;
  if (typeof score !== 'number' || isNaN(score) || score < 0 || score > 100) return null;

  return {
    score: Math.round(score),
    flags: Array.isArray(parsed.flags) ? parsed.flags.filter(f => typeof f === 'string').slice(0, 10) as string[] : [],
  };
}

export async function analyzePost(
  title: string,
  postType: string,
  intro: string,
  itemsSummary: string,
  config: AiModerationConfig,
): Promise<AiModerationResult> {
  const userMessage = `Title: ${title}\nType: ${postType}\nIntro: ${intro}\nItems: ${itemsSummary}`;

  // First attempt
  const first = await callDeepSeek(buildPrompt(postType), userMessage, config);
  let result = parseScore(first.raw);
  let tokens = first.tokens;

  // Retry on missing/invalid score
  if (!result) {
    const retryPrompt = `You are a content quality analyzer. Score this ${postType} post 0-100. Return ONLY valid JSON: {"score": <0-100>, "flags": ["<issue>"]}. You MUST include a "score" field. Do not omit it. Score the following post:\n\n${userMessage}`;
    const second = await callDeepSeek(retryPrompt, userMessage, config);
    tokens += second.tokens;
    result = parseScore(second.raw);
  }

  if (!result) {
    const firstSnippet = first.raw.substring(0, 200);
    throw new Error(`AI returned invalid response: unable to extract score. Raw: ${JSON.stringify(firstSnippet)}`);
  }

  return {
    score: result.score,
    flags: result.flags,
    model: config.model,
    prompt_tokens: tokens,
  };
}
