/**
 * Builds the daily news reading: headlines -> spoken Japanese -> audio.
 *
 * Two rules shape this file.
 *
 * First, the model is never allowed to *write* news. It receives the day's real
 * headlines and is constrained to turning them into natural spoken Japanese and
 * nothing else -- no added detail, no numbers it was not given, no invented
 * context. She has no way to catch a confabulated story, and no reason to doubt
 * one. The source is named out loud so she always knows where it came from.
 *
 * Second, it must never make her wait. Generation is fired off in the background
 * at startup; the newspaper plays the newest clip that already exists and says
 * which day it is from. Nothing blocks, and nothing stale is ever passed off as
 * today's.
 */
import type { NewsConfig } from "../content/schema";
import { japanDate, japanDateLabel, putClip, type NewsClip } from "./newsCache";

const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * Tauri routes HTTP through Rust, which sidesteps the WebView's CORS rules. In
 * a plain browser (npm run dev) that is unavailable, so the feed request will be
 * blocked by CORS -- expected, and why the news is only testable via `tauri dev`.
 */
async function http(input: string, init?: RequestInit): Promise<Response> {
  try {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return await tauriFetch(input, init);
  } catch {
    return await globalThis.fetch(input, init);
  }
}

/** Pulls <title> out of each <item>. Enough for RSS; no XML library needed. */
export function parseHeadlines(xml: string, limit: number): string[] {
  const titles: string[] = [];
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const titlePattern = /<title\b[^>]*>([\s\S]*?)<\/title>/i;

  let match: RegExpExecArray | null;
  while ((match = itemPattern.exec(xml)) !== null && titles.length < limit) {
    const titleMatch = match[1]?.match(titlePattern);
    const raw = titleMatch?.[1];
    if (!raw) continue;
    const text = raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (text) titles.push(text);
  }
  return titles;
}

async function fetchHeadlines(config: NewsConfig): Promise<string[]> {
  const response = await http(config.feedUrl, { method: "GET" });
  if (!response.ok) throw new Error(`feed responded ${response.status}`);
  const headlines = parseHeadlines(await response.text(), config.maxHeadlines);
  if (!headlines.length) throw new Error("no headlines found in the feed");
  return headlines;
}

function buildPrompt(config: NewsConfig, headlines: string[], dateLabel: string): string {
  const region = config.regionHintJa
    ? `${config.regionHintJa}に関係する見出しがあれば先に読んでください。`
    : "";
  return [
    "あなたは日本のラジオのニュース読み上げ担当です。",
    "90歳の女性が一人で聞きます。ゆっくり、やさしく、はっきりとした話し言葉にしてください。",
    "",
    "厳守すること：",
    "1. 与えられた見出しに書かれていないことは、絶対に足さないでください。",
    "2. 数字・地名・人名は、与えられたもの以外を出さないでください。",
    "3. 推測や解説、意見を加えないでください。見出しの内容だけを整えて伝えてください。",
    "4. わからないことは、触れないでください。",
    "",
    `最初に「${dateLabel}、${config.feedNameJa}の主な見出しをお伝えします。」と言ってください。`,
    region,
    "最後に「以上、主な見出しでした。」と結んでください。",
    "全体で90秒ほど、400字以内におさめてください。",
    "記号や箇条書きは使わず、読み上げ用の文章だけを出力してください。",
    "",
    "今日の見出し：",
    ...headlines.map((headline, index) => `${index + 1}. ${headline}`),
  ]
    .filter(Boolean)
    .join("\n");
}

async function writeScript(
  apiKey: string,
  config: NewsConfig,
  headlines: string[],
  dateLabel: string,
): Promise<string> {
  const response = await http(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.textModel,
      // Low temperature: this is a rewrite task, not a creative one.
      temperature: 0.3,
      max_tokens: 700,
      messages: [{ role: "user", content: buildPrompt(config, headlines, dateLabel) }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`chat/completions ${response.status} ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) throw new Error("the model returned an empty script");
  return script;
}

async function speak(apiKey: string, config: NewsConfig, script: string): Promise<Blob> {
  const response = await http(`${OPENAI_BASE}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.speechModel,
      voice: config.voice,
      input: script,
      response_format: "mp3",
      speed: 0.95,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`audio/speech ${response.status} ${detail.slice(0, 200)}`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 1024) throw new Error("the speech response was empty");
  return new Blob([buffer], { type: "audio/mpeg" });
}

/**
 * Generates and stores today's clip. Throws on failure; callers decide whether
 * that is worth showing anyone (at startup it is not).
 */
export async function generateTodaysClip(
  apiKey: string,
  config: NewsConfig,
): Promise<NewsClip> {
  const date = japanDate();
  const dateLabel = japanDateLabel(date);

  const headlines = await fetchHeadlines(config);
  const script = await writeScript(apiKey, config, headlines, dateLabel);
  const audio = await speak(apiKey, config, script);

  const clip: NewsClip = {
    date,
    audio,
    script,
    headlines,
    sourceNameJa: config.feedNameJa,
    createdAt: Date.now(),
  };
  await putClip(clip);
  return clip;
}
