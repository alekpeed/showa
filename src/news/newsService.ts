/**
 * Builds the daily news reading: find the day's gentle news -> spoken Japanese
 * -> audio.
 *
 * Two rules shape this file.
 *
 * First, the model is never allowed to *invent* news. In "web-search" mode that
 * is enforced structurally: the request must go to a search-enabled model with
 * the web_search tool, and a response carrying no url_citation annotations is
 * rejected outright rather than spoken. A model answering from its own weights
 * would produce fluent, plausible, entirely fictional Japanese news, and she has
 * no way to catch that and no reason to doubt it. The citation check is the one
 * guard that cannot be talked around by prompt wording.
 *
 * Second, it must never make her wait. Generation is fired off in the background
 * at startup; the newspaper plays the newest clip that already exists and says
 * which day it is from. Nothing blocks, and nothing stale is passed off as new.
 */
import type { NewsConfig } from "../content/schema";
import { japanDate, japanDateLabel, putClip, type NewsClip, type NewsSource } from "./newsCache";

const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * Tauri routes HTTP through Rust, which sidesteps the WebView's CORS rules. In a
 * plain browser (npm run dev) that is unavailable, so requests will be blocked --
 * expected, and why the news is only testable via `tauri dev`.
 */
async function http(input: string, init?: RequestInit): Promise<Response> {
  try {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return await tauriFetch(input, init);
  } catch {
    return await globalThis.fetch(input, init);
  }
}

async function failure(response: Response, label: string): Promise<Error> {
  const detail = await response.text().catch(() => "");
  return new Error(`${label} ${response.status} ${detail.slice(0, 240)}`);
}

/* ------------------------------------------------------------------------- */
/* Shared prompt                                                              */
/* ------------------------------------------------------------------------- */

const TONE_RULES = [
  "取り上げてよい話題：地域の行事やお祭り、季節の花や自然、農業や漁業の実り、",
  "受賞や記録、伝統文化や職人、動物や動物園、料理や食べ物、こどもや学校の話題、",
  "音楽や芸能の明るい話題、長寿や再会など心あたたまる出来事。",
  "",
  "取り上げてはいけない話題：事故、火災、災害、事件、犯罪、逮捕、訴訟、",
  "病気や死亡、戦争や紛争、政治の対立、経済の悪化、不祥事、批判や炎上。",
].join("\n");

function speechRules(config: NewsConfig, dateLabel: string, sourceLabel: string): string {
  const region = config.regionHintJa
    ? `${config.regionHintJa}の話題があれば、できるだけ先に入れてください。`
    : "";
  return [
    "あなたは日本のラジオの読み上げ担当です。",
    "90歳の女性が一人で聞きます。ゆっくり、やさしく、はっきりとした話し言葉にしてください。",
    "",
    `最初に「${dateLabel}、${sourceLabel}。」と言ってください。`,
    region,
    "最後に「以上、今日の明るい話題でした。」と結んでください。",
    "全体で90秒ほど、400字以内におさめてください。",
    "記号・箇条書き・URL・出典の番号は使わず、読み上げ用の文章だけを出力してください。",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------------- */
/* Mode: web-search                                                           */
/* ------------------------------------------------------------------------- */

interface ResponsesPayload {
  output?: {
    type?: string;
    content?: {
      type?: string;
      text?: string;
      annotations?: { type?: string; url?: string; title?: string }[];
    }[];
  }[];
}

function extractResponse(payload: ResponsesPayload): { text: string; sources: NewsSource[] } {
  let text = "";
  const sources: NewsSource[] = [];
  const seen = new Set<string>();

  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (typeof part.text === "string") text += part.text;
      for (const annotation of part.annotations ?? []) {
        if (annotation.type !== "url_citation" || !annotation.url) continue;
        if (seen.has(annotation.url)) continue;
        seen.add(annotation.url);
        sources.push({ url: annotation.url, title: annotation.title ?? annotation.url });
      }
    }
  }
  return { text: text.trim(), sources };
}

async function searchForGentleNews(
  apiKey: string,
  config: NewsConfig,
  dateLabel: string,
): Promise<{ script: string; sources: NewsSource[] }> {
  const instructions = [
    `今日は${dateLabel}です。ウェブ検索を使って、ここ24時間ほどの日本の「明るいニュース・心あたたまる話題」を${config.maxHeadlines}件ほど探してください。`,
    "",
    TONE_RULES,
    "",
    "検索と事実について厳守すること：",
    "1. 必ずウェブ検索で実際に見つけた記事だけを使ってください。",
    "2. 検索で確認できないことは、絶対に書かないでください。",
    "3. 数字・地名・人名・日付は、記事に書かれているものだけを使ってください。",
    "4. 明るい話題が少ない日は、無理に数を揃えず、見つかった分だけにしてください。",
    "5. ふさわしい話題が一つも見つからないときは、「今日はお伝えできる明るい話題が見つかりませんでした。」とだけ答えてください。",
    "",
    speechRules(config, dateLabel, "今日の日本の明るい話題をお伝えします"),
  ].join("\n");

  const response = await http(`${OPENAI_BASE}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.searchModel,
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
          // Bias retrieval toward Japanese-language sources.
          user_location: { type: "approximate", country: "JP" },
        },
      ],
      input: instructions,
    }),
  });

  if (!response.ok) throw await failure(response, "responses");

  const { text, sources } = extractResponse((await response.json()) as ResponsesPayload);
  if (!text) throw new Error("the model returned an empty script");

  // The structural guard. No citations means nothing was actually retrieved, so
  // whatever came back is the model talking from memory. Never speak it.
  if (!sources.length) {
    throw new Error(
      "the response carried no web citations — refusing to use it, since ungrounded output would be invented news",
    );
  }

  return { script: text, sources };
}

/* ------------------------------------------------------------------------- */
/* Mode: feed                                                                 */
/* ------------------------------------------------------------------------- */

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

async function readFromFeed(
  apiKey: string,
  config: NewsConfig,
  dateLabel: string,
): Promise<{ script: string; headlines: string[] }> {
  const feedResponse = await http(config.feedUrl, { method: "GET" });
  if (!feedResponse.ok) throw await failure(feedResponse, "feed");

  const headlines = parseHeadlines(await feedResponse.text(), config.maxHeadlines);
  if (!headlines.length) throw new Error("no headlines found in the feed");

  const prompt = [
    "以下は今日の見出しです。読み上げ用の文章に整えてください。",
    "",
    "厳守すること：",
    "1. 見出しに書かれていないことは、絶対に足さないでください。",
    "2. 数字・地名・人名は、与えられたもの以外を出さないでください。",
    "3. 推測・解説・意見を加えないでください。",
    "",
    speechRules(config, dateLabel, `${config.feedNameJa}の主な見出しをお伝えします`),
    "",
    "見出し：",
    ...headlines.map((headline, index) => `${index + 1}. ${headline}`),
  ].join("\n");

  const response = await http(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.textModel,
      // Low temperature: this is a rewrite task, not a creative one.
      temperature: 0.3,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw await failure(response, "chat/completions");

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) throw new Error("the model returned an empty script");

  return { script, headlines };
}

/* ------------------------------------------------------------------------- */
/* Speech                                                                     */
/* ------------------------------------------------------------------------- */

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

  if (!response.ok) throw await failure(response, "audio/speech");

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 1024) throw new Error("the speech response was empty");
  return new Blob([buffer], { type: "audio/mpeg" });
}

/* ------------------------------------------------------------------------- */

/**
 * Generates and stores today's clip. Throws on failure; callers decide whether
 * that is worth showing anyone (at startup it is not).
 */
export async function generateTodaysClip(apiKey: string, config: NewsConfig): Promise<NewsClip> {
  const date = japanDate();
  const dateLabel = japanDateLabel(date);

  let script: string;
  let headlines: string[] = [];
  let sources: NewsSource[] = [];

  if (config.mode === "web-search") {
    const found = await searchForGentleNews(apiKey, config, dateLabel);
    script = found.script;
    sources = found.sources;
  } else {
    const read = await readFromFeed(apiKey, config, dateLabel);
    script = read.script;
    headlines = read.headlines;
  }

  const audio = await speak(apiKey, config, script);

  const clip: NewsClip = {
    date,
    audio,
    script,
    headlines,
    sources,
    sourceNameJa: config.mode === "web-search" ? "今日の明るい話題" : config.feedNameJa,
    createdAt: Date.now(),
  };
  await putClip(clip);
  return clip;
}
