// worker/src/game.ts
// 纯函数：无副作用，随机性通过参数注入，可单测。

/** 卧底获胜或平民获胜的类型（Task 9 建 types.ts 后可改为 import，此处内联）。 */
export type Winner = "civilian" | "undercover";

/** 词对接口（parseWordPair / pickFallback 的返回值）。 */
export interface WordPair {
  civilianWord: string;
  undercoverWord: string;
}

// ─────────────────── Task 5 ───────────────────

/** 从玩家 id 列表中按注入的随机源选一个作为卧底。rand() ∈ [0,1)。 */
export function pickUndercover(playerIds: string[], rand: () => number): string {
  return playerIds[Math.floor(rand() * playerIds.length)];
}

/** 把存活者列表轮转到从 startIndex 开始（每轮随机首发言者，其余按原座位顺序）。 */
export function computeSpeakingOrder(aliveIds: string[], startIndex: number): string[] {
  const n = aliveIds.length;
  const start = ((startIndex % n) + n) % n;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(aliveIds[(start + i) % n]);
  }
  return out;
}

// ─────────────────── Task 6 ───────────────────

/** 统计票数。topIds = 得票最高者（可能多个 = 平票）；无票时为空数组。 */
export function tallyVotes(votes: Record<string, string>): {
  counts: Record<string, number>;
  topIds: string[];
} {
  const counts: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    counts[target] = (counts[target] ?? 0) + 1;
  }
  let max = 0;
  for (const c of Object.values(counts)) {
    if (c > max) {
      max = c;
    }
  }
  const topIds = max === 0 ? [] : Object.keys(counts).filter((id) => counts[id] === max);
  return { counts, topIds };
}

// ─────────────────── Task 7 ───────────────────

/**
 * 出局后判胜负。按序：卧底出局→平民胜；否则存活<=2→卧底胜；否则继续(null)。
 * eliminatedRole=null 表示本轮无人淘汰（平票）。
 * aliveCount<=2 而非==2 为防御增强：合法输入行为不变，避免极端态挂死。
 */
export function checkWin(
  eliminatedRole: "civilian" | "undercover" | null,
  aliveCount: number,
): Winner | null {
  if (eliminatedRole === "undercover") {
    return "civilian";
  }
  if (aliveCount <= 2) {
    return "undercover";
  }
  return null;
}

// ─────────────────── Task 8 ───────────────────

/** 解析 LLM 返回文本为词对；容忍 ```json 包裹；非法/相同/缺字段返回 null。 */
export function parseWordPair(raw: string): WordPair | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    s = fence[1].trim();
  }
  const brace = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (brace >= 0 && end > brace) {
    s = s.slice(brace, end + 1);
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) {
    return null;
  }
  const c = (obj as Record<string, unknown>).civilianWord;
  const u = (obj as Record<string, unknown>).undercoverWord;
  if (typeof c !== "string" || typeof u !== "string") {
    return null;
  }
  const cw = c.trim();
  const uw = u.trim();
  if (!cw || !uw || cw === uw || cw.length > 12 || uw.length > 12) {
    return null;
  }
  return { civilianWord: cw, undercoverWord: uw };
}

/** 从内置库随机抽一对，尽量避开 recent 索引。rand() ∈ [0,1)。 */
export function pickFallback(
  bank: [string, string][],
  recent: number[],
  rand: () => number,
): WordPair & { index: number } {
  const recentSet = new Set(recent);
  const pool = bank.map((_, i) => i).filter((i) => !recentSet.has(i));
  const candidates = pool.length > 0 ? pool : bank.map((_, i) => i);
  const index = candidates[Math.floor(rand() * candidates.length)];
  return { index, civilianWord: bank[index][0], undercoverWord: bank[index][1] };
}
