import { WORD_GEN_TIMEOUT_MS } from "./constants";
import { parseWordPair, pickFallback, type WordPair } from "./game";
import { WORD_BANK } from "./wordbank";
import type { Env } from "./types";

const SYSTEM_PROMPT =
  "你是「谁是卧底」出题器。给出一对中文词语：相近、易混淆但有明确区别，适合作为平民词与卧底词。" +
  '只输出 JSON：{"civilianWord":"…","undercoverWord":"…"}，各不超过8字，不要解释。';

/** 调 DeepSeek 生成一对词。任何失败（超时/网络/非2xx/解析失败）抛出。 */
async function fetchFromDeepSeek(env: Env): Promise<WordPair> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("no key");
  }
  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "出一对新词。" },
      ],
      temperature: 1.3,
      max_tokens: 60,
    }),
    signal: AbortSignal.timeout(WORD_GEN_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`deepseek ${resp.status}`);
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const pair = parseWordPair(content);
  if (!pair) {
    throw new Error("parse failed");
  }
  return pair;
}

/**
 * 取一对词：优先 DeepSeek，失败兜底内置库。
 * 返回词对 + （兜底命中的）库索引（用于近期去重，DeepSeek 命中时为 -1）。
 */
export async function getWordPair(
  env: Env,
  recentIndices: number[],
): Promise<{ pair: WordPair; bankIndex: number }> {
  try {
    const pair = await fetchFromDeepSeek(env);
    return { pair, bankIndex: -1 };
  } catch {
    const f = pickFallback(WORD_BANK, recentIndices, Math.random);
    return {
      pair: { civilianWord: f.civilianWord, undercoverWord: f.undercoverWord },
      bankIndex: f.index,
    };
  }
}
