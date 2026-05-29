# 谁是卧底（Undercover）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个无需登录、3–6 人在线联机的「谁是卧底」网页游戏，复用 `../draw-guess` 的 Cloudflare 实时房间底座，部署到 `undercover.dengjiabei.cn`。

**Architecture:** 单仓库两包：前端 React18 + Vite + Twind（Linear 主题），后端 Cloudflare Workers + Durable Objects（一房间一 DO，Hibernatable WebSocket）。服务端权威驱动状态机（lobby→describing→voting→reveal→ended），核心玩法逻辑抽成 `worker/src/game.ts` 纯函数并单测；发词优先 DeepSeek、失败兜底内置词库。

**Tech Stack:** React 18 / TypeScript / Vite / Twind / Cloudflare Workers / Durable Objects (SQLite) / WebSocket / Vitest / DeepSeek API / GitHub Actions。

**参考来源（频繁引用）：** `../draw-guess`（同款底座）；本仓库 `docs/superpowers/specs/2026-05-29-undercover-game-design.md`（设计契约，冲突以 spec 为准）。

**约定（全程遵守）：** TS 严格模式；所有 `if` 带 `{}`；git commit 中文、末尾 `合作：Claude Code Opus`；每个 Task 末尾 commit；改动后跑 `npx tsc --noEmit` + `npm run lint`。

---

## 文件结构总览（决定分解边界）

| 文件 | 职责 | 来源 |
|---|---|---|
| `src/api.ts` | apiUrl / wsUrl | 逐字移植 |
| `src/main.tsx` | 入口 + Twind install（**Linear token**） | 移植改主题 |
| `src/App.tsx` | 路由（首页/昵称/房间）+ sessionStorage 身份 | 移植精简 |
| `src/hooks/useWebSocket.ts` | WS 连接/重连/心跳/leave | 逐字移植（仅改 key 名） |
| `src/types/protocol.ts` | ⭐ 前后端共享消息契约 | 新写 |
| `src/pages/Home.tsx` | 建房 / 加入 | 新写 |
| `src/pages/Room.tsx` | 消息分发（ref 模式）+ 阶段路由 | 新写（借鉴结构） |
| `src/components/*` | Lobby / WordCard / PlayerList / DescribePanel / VotePanel / RevealOverlay / GameOver / ChatPanel / Toast | 新写 |
| `worker/src/index.ts` | 父 Worker：路由 + Origin 白名单 + 建房 | 移植改域名/默认人数 |
| `worker/src/constants.ts` | 可调参数 + 协议版本 | 新写（参考） |
| `worker/src/types.ts` | DO 内部类型 | 新写 |
| `worker/src/game.ts` | ⭐ 纯逻辑：选卧底/发言序/计票/胜负/词解析/兜底 | 新写 + **TDD** |
| `worker/src/game.test.ts` | game.ts 单测 | 新写 + **TDD** |
| `worker/src/words.ts` | DeepSeek 调用 + 6s 超时 + 兜底编排 | 新写 |
| `worker/src/wordbank.ts` | 内置词对库 ≥50 | 新写 |
| `worker/src/room.ts` | ⭐ GameRoom DO：状态机 + handlers | 新写（移植底座 + 新玩法） |
| `worker/wrangler.toml` | DO 绑定 + routes + 迁移 | 移植改名 |
| `.github/workflows/*` | Pages / Worker 部署 | 移植改名 |
| `DESIGN.md` | Linear 设计系统 | 抓取 |

---

## Phase 0：脚手架

### Task 1: 前端脚手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.npmrc`, `.gitignore`, `.env.development`, `src/vite-env.d.ts`, `src/api.ts`, `src/main.tsx`

- [ ] **Step 1: 逐字复制以下文件**（内容与 `../draw-guess` 同名文件一致）：`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`eslint.config.js`、`.prettierrc.json`、`.prettierignore`、`.npmrc`、`src/vite-env.d.ts`、`src/api.ts`。

- [ ] **Step 2: 写 `package.json`**（基于 draw-guess，去掉 `@uiw/react-color` 与 `@babel/runtime`，改 name）：

```json
{
  "name": "undercover",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:worker": "cd worker && npx wrangler dev",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint \"src/**/*.{ts,tsx}\" \"worker/src/**/*.ts\"",
    "lint:fix": "eslint \"src/**/*.{ts,tsx}\" \"worker/src/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\" \"worker/src/**/*.ts\"",
    "deploy:worker": "cd worker && npx wrangler deploy",
    "deploy:pages": "npm run build && npx wrangler pages deploy dist --project-name=undercover --commit-message=cli-deploy"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@twind/core": "^1.1.3",
    "@twind/preset-autoprefix": "^1.0.7",
    "@twind/preset-tailwind": "^1.1.4"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "globals": "^15.14.0",
    "prettier": "^3.4.2",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.18.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 3: 写 `index.html`**（复制 draw-guess 的，标题改「谁是卧底」，`<body class="font-text text-body text-ink">`；**移除 draw-guess 的 `min-width:1200px` 桌面限制**，本游戏需响应式适配较小屏）。

- [ ] **Step 4: 写 `.env.development`**：`VITE_API_BASE=https://undercover.dengjiabei.cn`（本地默认连线上 Worker；本地联调后端时再临时改 `http://localhost:8787`）。

- [ ] **Step 5: 写 `src/main.tsx`**（结构同 draw-guess，**主题 token 待 Task 3 抓到 Linear DESIGN.md 后填**，先放占位 Apple token 保证可编译；去掉 `ignorelist`）。

- [ ] **Step 6: 安装依赖并验证**

Run: `npm install --legacy-peer-deps`
Run: `npx tsc --noEmit`
Expected: 无错误（此时无 App.tsx，main.tsx 暂时 `import App` 会报错 → 先在 main.tsx 末尾用最简 `createRoot(...).render(<div>boot</div>)` 占位，App 在 Phase 5 接入）。

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: 初始化前端脚手架（Vite + React + Twind）"
```

---

### Task 2: 后端脚手架 + Vitest

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.toml`, `worker/vitest.config.ts`, `worker/src/constants.ts`

- [ ] **Step 1: 写 `worker/package.json`**

```json
{
  "name": "undercover-worker",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241205.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8",
    "wrangler": "^3.95.0"
  }
}
```
（版本以 draw-guess 的 `worker/package.json` 实际值为准，缺的补上 `vitest`。）

- [ ] **Step 2: 写 `worker/tsconfig.json`**（复制 draw-guess 的 worker tsconfig）。

- [ ] **Step 3: 写 `worker/wrangler.toml`**

```toml
name = "undercover-worker"
main = "src/index.ts"
compatibility_date = "2024-12-05"
workers_dev = true

routes = [
  { pattern = "undercover.dengjiabei.cn/api/*", zone_name = "dengjiabei.cn" }
]

[durable_objects]
bindings = [
  { name = "GAME_ROOM", class_name = "GameRoom" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]
```

- [ ] **Step 4: 写 `worker/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 5: 写 `worker/src/constants.ts`**

```ts
// 可调参数与协议常量。集中在此，便于调整而无需读 room 逻辑。

// 房间容量
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

// 输入长度上限（前端 input maxLength 必须与此一致）
export const MAX_NAME_LENGTH = 10;
export const MAX_DESCRIBE_LENGTH = 50;
export const MAX_CHAT_LENGTH = 200;
export const MAX_CHAT_HISTORY = 200;

// 阶段计时（由 DO alarm 驱动）
export const TURN_MS = 60_000; // 单人发言倒计时
export const VOTE_MS = 30_000; // 投票倒计时
export const REVEAL_MS = 5_000; // 公布停留
export const WORD_GEN_TIMEOUT_MS = 6_000; // DeepSeek 超时

// 断线 / 生命周期
export const RECONNECT_GRACE_MS = 30_000;
export const QUICK_LEAVE_GRACE_MS = 5_000;
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
export const ACTIVITY_PERSIST_MIN_INTERVAL_MS = 30_000;

// rate limit（每 ws，滚动窗口）
export const RATE_LIMIT_WINDOW_MS = 1000;
export const RATE_LIMIT_MAX_MSGS = 100;

// 协议版本（与 src/types/protocol.ts 双写一致；breaking 才 bump）
export const PROTOCOL_VERSION = 1;
```

- [ ] **Step 6: 验证 + Commit**

Run: `cd worker && npm install`
Run: `npx tsc --noEmit`（此时无 index.ts/room.ts，会因 main 缺失报错 → 先建一个 `worker/src/index.ts` 占位 `export {}` + 一个空 `room.ts` 导出占位 class，下一阶段替换。或先跳过 tsc 到 Task 11 再验）。

```bash
git add -A
git commit -m "chore: 初始化 worker 脚手架（wrangler + vitest + constants）"
```

---

### Task 3: 抓取 Linear DESIGN.md 并落地主题

**Files:**
- Create: `DESIGN.md`
- Modify: `src/main.tsx`

- [ ] **Step 1: 抓取 Linear 设计系统**

从 `https://github.com/VoltAgent/awesome-design-md` 仓库取 Linear 的 `DESIGN.md`（raw 路径形如 `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/linear/DESIGN.md`，以仓库实际目录为准），保存为项目根 `DESIGN.md`。

- [ ] **Step 2: 从 DESIGN.md 提取 token，替换 `src/main.tsx` 的 `theme.extend`**

按 DESIGN.md 的 colors / typography / radius / shadow 规范，落地为 Twind theme token（颜色：背景深色、主色、文字主/次、边线；字体：Inter/系统栈；圆角；阴影）。结构参照 draw-guess `main.tsx`，但值用 Linear 的。所有组件后续只用 token，禁止内联 hex。

- [ ] **Step 3: 验证 + Commit**

Run: `npm run dev` → 打开页面确认 boot 占位渲染、无 Twind 告警。

```bash
git add -A
git commit -m "feat(theme): 接入 Linear 设计系统 DESIGN.md 与 Twind 主题 token"
```

---

## Phase 1：共享协议

### Task 4: `src/types/protocol.ts`（前后端契约）

**Files:**
- Create: `src/types/protocol.ts`

- [ ] **Step 1: 写完整协议类型**

```ts
// 前后端共享消息契约。worker 端 types/room 手动镜像字段（不跨包 import）。
// 与 worker/src/constants.ts 的 PROTOCOL_VERSION 双写一致。
export const PROTOCOL_VERSION = 1;

export type GamePhase = "lobby" | "describing" | "voting" | "reveal" | "ended";
export type Role = "civilian" | "undercover";
export type Winner = "civilian" | "undercover";

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  alive: boolean; // 是否在场未出局（出局者留房观战）
}

export interface DescribeEntry {
  playerId: string;
  text: string;
  round: number;
}

export interface ChatEntry {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

// ---------- Client → Server ----------
export interface C_Join { type: "join"; playerName: string; playerId?: string; v?: number; }
export interface C_StartGame { type: "startGame"; }
export interface C_Describe { type: "describe"; text: string; }
export interface C_Vote { type: "vote"; targetId: string; }
export interface C_Chat { type: "chat"; text: string; }
export interface C_NextGame { type: "nextGame"; }
export interface C_Leave { type: "leave"; }
export interface C_Ping { type: "ping"; }
export type ClientMessage =
  | C_Join | C_StartGame | C_Describe | C_Vote | C_Chat | C_NextGame | C_Leave | C_Ping;

// ---------- Server → Client ----------
export interface S_RoomState {
  type: "roomState";
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
  phase: GamePhase;
  maxPlayers: number;
  yourId: string;
  round: number;
  currentSpeakerId?: string;
  deadline?: number;          // 当前阶段倒计时绝对时间戳（describing/voting）
  speakingOrder?: string[];
  descriptions?: DescribeEntry[]; // 已发言记录（累积）
  votedPlayerIds?: string[];      // 本轮已投票者（不含票向）
  tiebreakCandidates?: string[];
  yourWord?: string;          // 仅本人的词（游戏中）
  chatHistory?: ChatEntry[];
}
export interface S_PlayerJoined { type: "playerJoined"; player: PlayerInfo; }
export interface S_PlayerLeft { type: "playerLeft"; playerId: string; revealedRole?: Role; }
export interface S_GameStarted {
  type: "gameStarted";
  yourWord: string;           // 逐 ws 个性化
  round: number;
  speakingOrder: string[];
  currentSpeakerId: string;
  deadline: number;
}
export interface S_PhaseChange {
  type: "phaseChange";
  phase: GamePhase;
  round?: number;
  currentSpeakerId?: string;
  deadline?: number;
  speakingOrder?: string[];
  tiebreakCandidates?: string[];
}
export interface S_TurnChange { type: "turnChange"; currentSpeakerId: string; deadline: number; }
export interface S_DescribeUpdate { type: "describeUpdate"; playerId: string; text: string; round: number; }
export interface S_VoteUpdate { type: "voteUpdate"; voterId: string; }
export interface S_VoteResult {
  type: "voteResult";
  tally: Record<string, number>;
  eliminatedId: string | null;
  eliminatedRole?: Role;
  tiebreak?: { candidates: string[]; round: number };
}
export interface S_GameOver {
  type: "gameOver";
  winner: Winner;
  undercoverId: string;
  civilianWord: string;
  undercoverWord: string;
  roles: Record<string, Role>;
}
export interface S_Chat { type: "chat"; playerId: string; playerName: string; text: string; timestamp: number; }
export interface S_Error { type: "error"; message: string; }
export interface S_RoomClosed { type: "roomClosed"; reason: string; }
export interface S_Pong { type: "pong"; }
export type ServerMessage =
  | S_RoomState | S_PlayerJoined | S_PlayerLeft | S_GameStarted | S_PhaseChange
  | S_TurnChange | S_DescribeUpdate | S_VoteUpdate | S_VoteResult | S_GameOver
  | S_Chat | S_Error | S_RoomClosed | S_Pong;
```

- [ ] **Step 2: 验证 + Commit**

Run: `npx tsc --noEmit`
```bash
git add -A && git commit -m "feat(protocol): 定义谁是卧底前后端共享消息契约"
```

---

## Phase 2：核心玩法纯逻辑（TDD）

> `worker/src/game.ts` 为无副作用纯函数，独立单测；`room.ts` 只负责状态/IO 并调用它们。每个函数：先写失败测试 → 跑红 → 实现 → 跑绿 → commit。

### Task 5: `pickUndercover` + `computeSpeakingOrder`

**Files:**
- Create: `worker/src/game.ts`, `worker/src/game.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// worker/src/game.test.ts
import { describe, it, expect } from "vitest";
import { pickUndercover, computeSpeakingOrder } from "./game";

describe("pickUndercover", () => {
  it("从玩家中选出一个，索引由注入的 rand 决定", () => {
    const ids = ["a", "b", "c"];
    expect(pickUndercover(ids, () => 0)).toBe("a");
    expect(pickUndercover(ids, () => 0.99)).toBe("c"); // floor(0.99*3)=2
  });
});

describe("computeSpeakingOrder", () => {
  it("从 startIndex 开始按原顺序轮转", () => {
    expect(computeSpeakingOrder(["a", "b", "c", "d"], 2)).toEqual(["c", "d", "a", "b"]);
  });
  it("startIndex 0 时不变", () => {
    expect(computeSpeakingOrder(["a", "b", "c"], 0)).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: 跑红** — Run: `cd worker && npx vitest run src/game.test.ts` → FAIL（函数未定义）。

- [ ] **Step 3: 实现**

```ts
// worker/src/game.ts
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
```

- [ ] **Step 4: 跑绿** — Run: `npx vitest run src/game.test.ts` → PASS。
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(game): 卧底选取与发言顺序纯函数（含单测）"`

---

### Task 6: `tallyVotes`

**Files:** Modify: `worker/src/game.ts`, `worker/src/game.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { tallyVotes } from "./game";

describe("tallyVotes", () => {
  it("唯一最高票", () => {
    const r = tallyVotes({ a: "x", b: "x", c: "y" });
    expect(r.counts).toEqual({ x: 2, y: 1 });
    expect(r.topIds).toEqual(["x"]);
  });
  it("平票返回多个候选", () => {
    const r = tallyVotes({ a: "x", b: "y" });
    expect(r.topIds.sort()).toEqual(["x", "y"]);
  });
  it("无人投票时 topIds 为空", () => {
    expect(tallyVotes({}).topIds).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑红** — Run: `npx vitest run src/game.test.ts` → FAIL。
- [ ] **Step 3: 实现**

```ts
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
```

- [ ] **Step 4: 跑绿** → PASS。 **Step 5: Commit** — `git commit -am "feat(game): 投票计票纯函数（含单测）"`

---

### Task 7: `checkWin`

**Files:** Modify: `worker/src/game.ts`, `worker/src/game.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { checkWin } from "./game";

describe("checkWin", () => {
  it("出局者是卧底 → 平民胜", () => {
    expect(checkWin("undercover", 5)).toBe("civilian");
  });
  it("出局平民后只剩2人 → 卧底胜", () => {
    expect(checkWin("civilian", 2)).toBe("undercover");
  });
  it("出局平民但仍>2人 → 继续", () => {
    expect(checkWin("civilian", 3)).toBeNull();
  });
  it("平票无人出局 → 继续", () => {
    expect(checkWin(null, 4)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑红** → FAIL。
- [ ] **Step 3: 实现**

```ts
import type { Winner } from "./types";

/**
 * 出局后判胜负。按序：卧底出局→平民胜；否则存活==2→卧底胜；否则继续(null)。
 * eliminatedRole=null 表示本轮无人淘汰（平票）。
 */
export function checkWin(
  eliminatedRole: "civilian" | "undercover" | null,
  aliveCount: number,
): Winner | null {
  if (eliminatedRole === "undercover") {
    return "civilian";
  }
  if (aliveCount === 2) {
    return "undercover";
  }
  return null;
}
```
（注：`Winner` 类型见 Task 9 的 `worker/src/types.ts`；若此刻 types.ts 未建，先在 game.ts 内联 `type Winner = "civilian"|"undercover"`，Task 9 建好后改为 import。）

- [ ] **Step 4: 跑绿** → PASS。 **Step 5: Commit** — `git commit -am "feat(game): 胜负判定纯函数（含单测）"`

---

### Task 8: 词对解析与兜底 `parseWordPair` + `pickFallback`

**Files:** Modify: `worker/src/game.ts`, `worker/src/game.test.ts`; Create: `worker/src/wordbank.ts`

- [ ] **Step 1: 写 `worker/src/wordbank.ts`**（手工精选 ≥50 对，示例起步，实现时补足）

```ts
// 内置词对兜底库：[平民词, 卧底词]，二者相近可辨。
export const WORD_BANK: [string, string][] = [
  ["周杰伦", "林俊杰"],
  ["苹果手机", "华为手机"],
  ["香菜", "芹菜"],
  ["可乐", "雪碧"],
  ["蜘蛛侠", "蝙蝠侠"],
  ["拿铁", "卡布奇诺"],
  ["西瓜", "冬瓜"],
  ["篮球", "排球"],
  ["微信", "QQ"],
  ["老虎", "豹子"],
  // …实现时补足到 ≥50 对
];
```

- [ ] **Step 2: 追加失败测试**

```ts
import { parseWordPair, pickFallback } from "./game";

describe("parseWordPair", () => {
  it("解析合法 JSON", () => {
    expect(parseWordPair('{"civilianWord":"猫","undercoverWord":"狗"}'))
      .toEqual({ civilianWord: "猫", undercoverWord: "狗" });
  });
  it("容忍代码块包裹", () => {
    expect(parseWordPair('```json\n{"civilianWord":"猫","undercoverWord":"狗"}\n```'))
      .toEqual({ civilianWord: "猫", undercoverWord: "狗" });
  });
  it("两词相同 → null", () => {
    expect(parseWordPair('{"civilianWord":"猫","undercoverWord":"猫"}')).toBeNull();
  });
  it("缺字段 / 非法 → null", () => {
    expect(parseWordPair("not json")).toBeNull();
    expect(parseWordPair('{"civilianWord":"猫"}')).toBeNull();
    expect(parseWordPair('{"civilianWord":"","undercoverWord":"狗"}')).toBeNull();
  });
});

describe("pickFallback", () => {
  it("避开 recent 索引", () => {
    const bank: [string, string][] = [["a", "b"], ["c", "d"], ["e", "f"]];
    const r = pickFallback(bank, [0, 1], () => 0); // 只剩索引2可选
    expect(r.index).toBe(2);
    expect(r.civilianWord).toBe("e");
  });
  it("recent 占满时退化为全集随机", () => {
    const bank: [string, string][] = [["a", "b"]];
    expect(pickFallback(bank, [0], () => 0).index).toBe(0);
  });
});
```

- [ ] **Step 3: 跑红** → FAIL。
- [ ] **Step 4: 实现**

```ts
import { WORD_BANK } from "./wordbank";

export interface WordPair { civilianWord: string; undercoverWord: string; }

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
): { index: number; civilianWord: string; undercoverWord: string } {
  const recentSet = new Set(recent);
  const pool = bank.map((_, i) => i).filter((i) => !recentSet.has(i));
  const candidates = pool.length > 0 ? pool : bank.map((_, i) => i);
  const index = candidates[Math.floor(rand() * candidates.length)];
  return { index, civilianWord: bank[index][0], undercoverWord: bank[index][1] };
}
```

- [ ] **Step 5: 跑绿** → PASS。 **Step 6: Commit** — `git commit -am "feat(game): 词对解析与内置兜底库（含单测）"`

---

## Phase 3：发词服务（DeepSeek）

### Task 9: `worker/src/types.ts` + `worker/src/words.ts`

**Files:** Create: `worker/src/types.ts`, `worker/src/words.ts`

- [ ] **Step 1: 写 `worker/src/types.ts`**

```ts
export type GamePhase = "lobby" | "describing" | "voting" | "reveal" | "ended";
export type Role = "civilian" | "undercover";
export type Winner = "civilian" | "undercover";

export interface PlayerAttachment {
  id: string;
  name: string;
  quickLeave?: boolean;
}
export interface DisconnectedPlayer {
  id: string;
  name: string;
  disconnectedAt: number;
  graceMs: number;
}
export interface ChatEntry {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}
export interface DescribeEntry {
  playerId: string;
  text: string;
  round: number;
}
export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  DEEPSEEK_API_KEY?: string; // Worker secret；缺失则直接走兜底
}
```
（把 Task 7 里 game.ts 内联的 `Winner` 改为从这里 import。）

- [ ] **Step 2: 写 `worker/src/words.ts`**

```ts
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
```

- [ ] **Step 3: 验证 + Commit**

Run: `cd worker && npx tsc --noEmit`（确保类型通过）
Run: `npx vitest run`（game.test 仍全绿）
```bash
git add -A && git commit -m "feat(words): DeepSeek 发词 + 6s 超时兜底内置库"
```

---

## Phase 4：后端房间 DO

### Task 10: 父 Worker `worker/src/index.ts`

**Files:** Create: `worker/src/index.ts`

- [ ] **Step 1: 移植 draw-guess 的 `worker/src/index.ts`，做以下改动：**
  - `Env` 改为从 `./types` import（含 `DEEPSEEK_API_KEY`）。
  - `isAllowedOrigin`：生产域名改 `https://undercover.dengjiabei.cn`，localhost/127 规则保留。
  - 建房 `POST /api/rooms`：`?max=N` 默认值与下限改用 `MIN_PLAYERS`/`MAX_PLAYERS`（替换 `MIN_MAX_PLAYERS`/`MAX_MAX_PLAYERS`）。
  - 路由 `/api/rooms`、`/api/rooms/:code`、`/api/rooms/:code/ws`、`/api/rooms/:code/quickleave` 全部保留（`:code` 仍为 `\d{6}`）。
  - 顶部 `export { GameRoom } from "./room";`

- [ ] **Step 2: 验证 + Commit**

Run: `npx tsc --noEmit`（room.ts 占位即可编译）
```bash
git add -A && git commit -m "feat(worker): 父 Worker 路由与 Origin 白名单"
```

---

### Task 11: `room.ts` 底座（生命周期/重连/大厅，无玩法）

**Files:** Create/replace: `worker/src/room.ts`

> 以 draw-guess `room.ts` 为蓝本移植**底座部分**，删除所有 draw/stroke/guess 逻辑，phase 改为本游戏 5 态，先只实现到「大厅」。

- [ ] **Step 1: 实现 DO 类骨架与状态字段**

```ts
import {
  ACTIVITY_PERSIST_MIN_INTERVAL_MS, INACTIVITY_TIMEOUT_MS, MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH, MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, PROTOCOL_VERSION,
  QUICK_LEAVE_GRACE_MS, RATE_LIMIT_MAX_MSGS, RATE_LIMIT_WINDOW_MS, RECONNECT_GRACE_MS,
} from "./constants";
import type {
  ChatEntry, DescribeEntry, DisconnectedPlayer, Env, GamePhase, PlayerAttachment, Role,
} from "./types";

interface PlayerInfoWire { id: string; name: string; isHost: boolean; alive: boolean; }

export class GameRoom implements DurableObject {
  private loaded = false;
  private created = false;
  private roomCode = "";
  private maxPlayers = MIN_PLAYERS;
  private hostId: string | null = null;
  private joinOrder: string[] = [];
  private phase: GamePhase = "lobby";
  private chatHistory: ChatEntry[] = [];
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private lastActivityAt = 0;
  private lastActivityPersistedAt = 0;

  // 玩法状态（游戏中才有意义）
  private civilianWord: string | null = null;
  private undercoverWord: string | null = null;
  private undercoverId: string | null = null;
  private eliminatedIds: string[] = [];     // 已出局（留房观战）
  private round = 0;
  private speakingOrder: string[] = [];
  private currentSpeakerIndex = 0;
  private descriptions: DescribeEntry[] = []; // 累积
  private votes: Record<string, string> = {};
  private voteRound: 1 | 2 = 1;
  private tiebreakCandidates: string[] = [];
  private phaseDeadline = 0;                 // describing/voting/reveal 的 alarm 截止
  private recentWordIndices: number[] = [];  // 内置库近期去重（内存即可）

  private wsMessageCounts = new WeakMap<WebSocket, { windowStart: number; count: number }>();

  constructor(private state: DurableObjectState, private env: Env) {}
  // …见后续 Step
}
```

- [ ] **Step 2: 移植底座方法**（从 draw-guess `room.ts` 逐一移植并按上面字段裁剪）：
  - `ensureLoaded()`：storage.get 读取 `created/roomCode/maxPlayers/hostId/joinOrder/phase/chatHistory/disconnectedPlayers/lastActivityAt` + 玩法字段（`civilianWord/undercoverWord/undercoverId/eliminatedIds/round/speakingOrder/currentSpeakerIndex/descriptions/votes/voteRound/tiebreakCandidates/phaseDeadline`）。无 stroke 分片逻辑。
  - `saveState()`：put 上述全部字段（无 strokes）。
  - `checkRateLimit` / `touchActivity`（节流）/ `getEffectivePlayerCount` / `getPlayer` / `getJoinedWebSockets` / `getJoinedCount` / `isPlayerActive`：逐字移植。
  - `send` / `broadcast`：逐字移植。
  - `getPlayerInfoList(): PlayerInfoWire[]`：按 joinOrder，`isHost = id===hostId`，`alive = isPlayerActive(id) && !eliminatedIds.includes(id)`。

- [ ] **Step 3: `scheduleNextAlarm()`** —— 在 draw-guess 版基础上**加入 `phaseDeadline`**：

```ts
private scheduleNextAlarm() {
  const candidates: number[] = [];
  for (const dp of this.disconnectedPlayers.values()) {
    candidates.push(dp.disconnectedAt + dp.graceMs);
  }
  if (this.lastActivityAt > 0 && this.getEffectivePlayerCount() > 0) {
    candidates.push(this.lastActivityAt + INACTIVITY_TIMEOUT_MS);
  }
  if (this.phaseDeadline > 0) {
    candidates.push(this.phaseDeadline);
  }
  if (candidates.length > 0) {
    this.state.storage.setAlarm(Math.min(...candidates));
  }
}
```

- [ ] **Step 4: `fetch()`**：移植 draw-guess（`/init` 带 `?max=` 用 MIN/MAX_PLAYERS 校验、`/quickleave`、room info、ws upgrade `acceptWebSocket`）。room info 的 `closed` 仍按 `count >= maxPlayers`。

- [ ] **Step 5: `webSocketMessage` 分发骨架**（先只接 join/ping/chat/leave，其余 case 留到后续 Task 追加）：

```ts
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
  if (typeof message !== "string") { return; }
  await this.ensureLoaded();
  if (!this.checkRateLimit(ws)) {
    this.send(ws, { type: "error", message: "消息频率过高，连接已断开" });
    try { ws.close(1008, "rate limited"); } catch { /* ignore */ }
    return;
  }
  let msg: Record<string, unknown>;
  try { msg = JSON.parse(message); } catch { return; }
  if (msg.type !== "join" && msg.type !== "ping") { await this.touchActivity(); }
  switch (msg.type) {
    case "join":
      await this.onJoin(ws, msg.playerName as string, msg.playerId as string | undefined,
        typeof msg.v === "number" ? msg.v : undefined);
      break;
    case "ping": this.send(ws, { type: "pong" }); break;
    case "chat": await this.onChat(ws, msg.text as string); break;
    case "leave": await this.onLeave(ws); break;
    // startGame / describe / vote / nextGame —— 后续 Task 追加
  }
}
async webSocketClose(ws: WebSocket) { await this.ensureLoaded(); await this.onDisconnect(ws); }
async webSocketError(ws: WebSocket) { await this.ensureLoaded(); await this.onDisconnect(ws); }
```

- [ ] **Step 6: `onJoin`（大厅 + 重连）**

```ts
private buildRoomState(ws: WebSocket, playerId: string) {
  const inGame = this.phase !== "lobby" && this.phase !== "ended";
  const yourWord = inGame
    ? (playerId === this.undercoverId ? this.undercoverWord : this.civilianWord)
    : undefined;
  this.send(ws, {
    type: "roomState",
    roomCode: this.roomCode,
    players: this.getPlayerInfoList(),
    hostId: this.hostId,
    phase: this.phase,
    maxPlayers: this.maxPlayers,
    yourId: playerId,
    round: this.round,
    currentSpeakerId: this.speakingOrder[this.currentSpeakerIndex],
    deadline: this.phaseDeadline || undefined,
    speakingOrder: this.speakingOrder,
    descriptions: this.descriptions,
    votedPlayerIds: Object.keys(this.votes),
    tiebreakCandidates: this.tiebreakCandidates.length ? this.tiebreakCandidates : undefined,
    ...(yourWord ? { yourWord } : {}),
    chatHistory: this.chatHistory,
  });
}

private async onJoin(ws: WebSocket, playerName: string, playerId?: string, clientVersion?: number) {
  if (clientVersion != null && clientVersion !== PROTOCOL_VERSION) {
    this.send(ws, { type: "error", message: "客户端版本过旧，请刷新页面" });
    try { ws.close(1000, "version mismatch"); } catch { /* ignore */ }
    return;
  }
  if (!this.created) {
    this.send(ws, { type: "error", message: "房间不存在" });
    try { ws.close(1000, "room not found"); } catch { /* ignore */ }
    return;
  }
  await this.touchActivity();

  if (playerId) {
    // 重连：disconnectedPlayers 恢复
    const dc = this.disconnectedPlayers.get(playerId);
    if (dc) {
      this.disconnectedPlayers.delete(playerId);
      const p: PlayerAttachment = { id: dc.id, name: dc.name };
      ws.serializeAttachment(p);
      await this.saveState();
      this.buildRoomState(ws, p.id);
      return;
    }
    // 旧 ws 尚未 close 的 take-over
    for (const { ws: oldWs, player: ex } of this.getJoinedWebSockets()) {
      if (ex.id === playerId && oldWs !== ws) {
        oldWs.serializeAttachment(null);
        try { oldWs.close(1000, "reconnected"); } catch { /* ignore */ }
        const p: PlayerAttachment = { id: ex.id, name: ex.name };
        ws.serializeAttachment(p);
        await this.saveState();
        this.buildRoomState(ws, p.id);
        return;
      }
    }
  }

  // 新玩家：只能在 lobby 加入
  if (this.phase !== "lobby") {
    this.send(ws, { type: "error", message: "游戏已开始，无法加入" });
    try { ws.close(1000, "game in progress"); } catch { /* ignore */ }
    return;
  }
  if (this.getEffectivePlayerCount() >= this.maxPlayers) {
    this.send(ws, { type: "error", message: "房间已满" });
    try { ws.close(1000, "room full"); } catch { /* ignore */ }
    return;
  }
  const player: PlayerAttachment = {
    id: crypto.randomUUID(),
    name: (playerName || `玩家${this.joinOrder.length + 1}`).slice(0, MAX_NAME_LENGTH),
  };
  ws.serializeAttachment(player);
  this.joinOrder.push(player.id);
  if (this.joinOrder.length === 1) { this.hostId = player.id; }
  await this.saveState();
  this.buildRoomState(ws, player.id);
  this.broadcast({
    type: "playerJoined",
    player: { id: player.id, name: player.name, isHost: player.id === this.hostId, alive: true },
  }, ws);
}
```

- [ ] **Step 7: `onChat` / `onLeave` / `onDisconnect`**：移植 draw-guess 的 `onChat`（用本 `ChatEntry` 形状、`MAX_CHAT_LENGTH`、`MAX_CHAT_HISTORY`），`onLeave`/`onDisconnect` 移植但调用本游戏的 `processActualLeave`（Task 14 实现完整版；此刻先实现「仅 lobby：移出 joinOrder + 广播 playerLeft + 空房重置」的简版，游戏中分支留 TODO 注释，Task 14 补全）。

- [ ] **Step 8: `alarm()` 骨架**：移植 draw-guess（处理 disconnected 过期 + inactivity 重置）。**phaseDeadline 分支留到 Task 12/13 追加**（先加注释占位）。

- [ ] **Step 9: 验证 + Commit**

Run: `cd worker && npx tsc --noEmit` → 通过。
（可选本地：`npx wrangler dev` + 用浏览器/wscat 连 `/api/rooms` 建房、`/ws` join，确认收到 roomState。）
```bash
git add -A && git commit -m "feat(room): DO 底座（生命周期/重连/大厅/聊天）"
```

---

### Task 12: `startGame` —— 发词 + 分配身份 + 进入描述

**Files:** Modify: `worker/src/room.ts`

- [ ] **Step 1: 在 `webSocketMessage` 的 switch 追加** `case "startGame": await this.onStartGame(ws); break;`

- [ ] **Step 2: 实现 `onStartGame` + 进入描述轮 + 发言推进辅助**

```ts
import { pickUndercover, computeSpeakingOrder } from "./game";
import { getWordPair } from "./words";
import { TURN_MS } from "./constants";

private aliveIds(): string[] {
  return this.joinOrder.filter(
    (id) => this.isPlayerActive(id) && !this.eliminatedIds.includes(id),
  );
}

private async onStartGame(ws: WebSocket) {
  const player = this.getPlayer(ws);
  if (!player || player.id !== this.hostId) { return; }
  if (this.phase !== "lobby") { return; }
  if (this.getJoinedCount() < MIN_PLAYERS) {
    this.send(ws, { type: "error", message: `至少需要 ${MIN_PLAYERS} 人才能开始` });
    return;
  }

  // 发词（DeepSeek → 兜底）
  const { pair, bankIndex } = await getWordPair(this.env, this.recentWordIndices);
  if (bankIndex >= 0) {
    this.recentWordIndices.push(bankIndex);
    if (this.recentWordIndices.length > 10) { this.recentWordIndices.shift(); }
  }
  this.civilianWord = pair.civilianWord;
  this.undercoverWord = pair.undercoverWord;

  // 分配身份（仅在场玩家参与）
  const players = this.joinOrder.filter((id) => this.isPlayerActive(id));
  this.undercoverId = pickUndercover(players, Math.random);
  this.eliminatedIds = [];
  this.round = 1;
  this.descriptions = [];
  this.votes = {};
  this.voteRound = 1;
  this.tiebreakCandidates = [];

  this.startDescribingRound();

  // 逐 ws 个性化下发各自的词
  for (const { ws: w, player: p } of this.getJoinedWebSockets()) {
    this.send(w, {
      type: "gameStarted",
      yourWord: p.id === this.undercoverId ? this.undercoverWord : this.civilianWord,
      round: this.round,
      speakingOrder: this.speakingOrder,
      currentSpeakerId: this.speakingOrder[this.currentSpeakerIndex],
      deadline: this.phaseDeadline,
    });
  }
  await this.saveState();
}

/** 开一轮描述：随机首发言者，设 phase/deadline/alarm。 */
private startDescribingRound() {
  const alive = this.aliveIds();
  const startIndex = Math.floor(Math.random() * alive.length);
  this.speakingOrder = computeSpeakingOrder(alive, startIndex);
  this.currentSpeakerIndex = 0;
  this.phase = "describing";
  this.phaseDeadline = Date.now() + TURN_MS;
  this.scheduleNextAlarm();
}
```

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit`
```bash
git add -A && git commit -m "feat(room): startGame 发词、分配卧底、进入首轮描述"
```

---

### Task 13: `describe` —— 轮流发言 + 超时跳过

**Files:** Modify: `worker/src/room.ts`

- [ ] **Step 1: switch 追加** `case "describe": await this.onDescribe(ws, msg.text as string); break;`

- [ ] **Step 2: 实现 `onDescribe` + 推进 + 转投票**

```ts
import { MAX_DESCRIBE_LENGTH, VOTE_MS } from "./constants";

private async onDescribe(ws: WebSocket, text: string) {
  const player = this.getPlayer(ws);
  if (!player || this.phase !== "describing") { return; }
  if (player.id !== this.speakingOrder[this.currentSpeakerIndex]) { return; } // 非当前发言者
  const trimmed = (text || "").trim().slice(0, MAX_DESCRIBE_LENGTH);
  if (!trimmed) { return; }
  this.recordDescription(player.id, trimmed);
  await this.saveState();
}

/** 记录描述并推进；广播 describeUpdate；轮完则转投票。 */
private recordDescription(playerId: string, text: string) {
  this.descriptions.push({ playerId, text, round: this.round });
  this.broadcast({ type: "describeUpdate", playerId, text, round: this.round });
  this.advanceSpeaker();
}

private advanceSpeaker() {
  this.currentSpeakerIndex++;
  if (this.currentSpeakerIndex >= this.speakingOrder.length) {
    this.enterVoting();
  } else {
    this.phaseDeadline = Date.now() + TURN_MS;
    this.scheduleNextAlarm();
    this.broadcast({
      type: "turnChange",
      currentSpeakerId: this.speakingOrder[this.currentSpeakerIndex],
      deadline: this.phaseDeadline,
    });
  }
}

private enterVoting() {
  this.phase = "voting";
  this.votes = {};
  this.voteRound = 1;
  this.tiebreakCandidates = [];
  this.phaseDeadline = Date.now() + VOTE_MS;
  this.scheduleNextAlarm();
  this.broadcast({ type: "phaseChange", phase: "voting", round: this.round, deadline: this.phaseDeadline });
}
```

- [ ] **Step 3: 在 `alarm()` 追加 phaseDeadline 分支（描述超时跳过）**

```ts
// alarm() 内，处理完 disconnected/inactivity 后、scheduleNextAlarm 前：
if (this.phaseDeadline > 0 && now >= this.phaseDeadline) {
  if (this.phase === "describing") {
    // 当前发言者超时：记空描述并推进
    const speakerId = this.speakingOrder[this.currentSpeakerIndex];
    this.recordDescription(speakerId, "（未描述）");
    await this.saveState();
  }
  // voting / reveal 分支见 Task 14
}
```

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsc --noEmit`
```bash
git add -A && git commit -m "feat(room): 轮流描述、发言推进与超时跳过"
```

---

### Task 14: `vote` —— 计票/加赛/出局/公布/胜负，及中途离开

**Files:** Modify: `worker/src/room.ts`

- [ ] **Step 1: switch 追加** `case "vote": await this.onVote(ws, msg.targetId as string); break;`

- [ ] **Step 2: 实现投票 + 计票编排**

```ts
import { tallyVotes, checkWin } from "./game";
import { REVEAL_MS } from "./constants";

private async onVote(ws: WebSocket, targetId: string) {
  const player = this.getPlayer(ws);
  if (!player || this.phase !== "voting") { return; }
  const alive = this.aliveIds();
  if (!alive.includes(player.id)) { return; }            // 出局者不能投
  if (player.id === targetId) { return; }                // 不能投自己
  if (!alive.includes(targetId)) { return; }             // 目标须存活
  if (this.voteRound === 2 && !this.tiebreakCandidates.includes(targetId)) { return; } // 加赛仅候选人
  this.votes[player.id] = targetId;
  this.broadcast({ type: "voteUpdate", voterId: player.id });
  // 全部存活者投完 → 立即计票
  if (alive.every((id) => this.votes[id] !== undefined)) {
    await this.tallyAndResolve();
  } else {
    await this.saveState();
  }
}

/** 计票：唯一最高→出局；平票→加赛(一次)→仍平票则无人淘汰。 */
private async tallyAndResolve() {
  const { counts, topIds } = tallyVotes(this.votes);
  if (topIds.length === 1) {
    await this.eliminateByVote(topIds[0], counts);
    return;
  }
  if (topIds.length > 1 && this.voteRound === 1) {
    // 加赛
    this.voteRound = 2;
    this.tiebreakCandidates = topIds;
    this.votes = {};
    this.phaseDeadline = Date.now() + VOTE_MS;
    this.scheduleNextAlarm();
    await this.saveState();
    this.broadcast({
      type: "voteResult", tally: counts, eliminatedId: null,
      tiebreak: { candidates: topIds, round: 2 },
    });
    this.broadcast({
      type: "phaseChange", phase: "voting", round: this.round,
      deadline: this.phaseDeadline, tiebreakCandidates: topIds,
    });
    return;
  }
  // 平票且已加赛 → 无人淘汰，直接进 reveal（eliminatedId=null）
  await this.enterReveal(null, null, counts);
}

/** 投票出局：标记出局 + 进 reveal（带身份）。 */
private async eliminateByVote(targetId: string, counts: Record<string, number>) {
  this.eliminatedIds.push(targetId);
  const role: Role = targetId === this.undercoverId ? "undercover" : "civilian";
  await this.enterReveal(targetId, role, counts);
}

/** 进入公布阶段：广播 voteResult，设 REVEAL_MS alarm，到点 advanceAfterReveal。 */
private async enterReveal(eliminatedId: string | null, role: Role | null, counts: Record<string, number>) {
  this.phase = "reveal";
  this.phaseDeadline = Date.now() + REVEAL_MS;
  this.scheduleNextAlarm();
  await this.saveState();
  this.broadcast({
    type: "voteResult", tally: counts, eliminatedId,
    ...(role ? { eliminatedRole: role } : {}),
  });
  this.broadcast({ type: "phaseChange", phase: "reveal", round: this.round });
}

/** reveal 到点：判胜负 → 结束 或 下一轮。 */
private async advanceAfterReveal() {
  const lastId = this.eliminatedIds[this.eliminatedIds.length - 1];
  const justEliminated = this.phaseWasElimination(lastId);
  const role: Role | null = justEliminated
    ? (lastId === this.undercoverId ? "undercover" : "civilian")
    : null;
  const winner = checkWin(role, this.aliveIds().length);
  if (winner) {
    await this.endGame(winner);
  } else {
    this.round++;
    this.descriptions = [];
    this.startDescribingRound();
    await this.saveState();
    this.broadcast({
      type: "phaseChange", phase: "describing", round: this.round,
      currentSpeakerId: this.speakingOrder[this.currentSpeakerIndex],
      deadline: this.phaseDeadline, speakingOrder: this.speakingOrder,
    });
  }
}
```

> **注**：`phaseWasElimination` 需判断「本次 reveal 是否真的淘汰了人」。简化做法：在 `enterReveal` 时把 `eliminatedId` 暂存到字段 `this.lastRevealEliminatedId`（可空，不持久化也可，但为重连安全建议持久化）。`advanceAfterReveal` 用它判 role，而非反推 `eliminatedIds` 末尾。实现时把上面 `justEliminated/lastId` 改为读 `this.lastRevealEliminatedId`。

- [ ] **Step 3: 修正 reveal 记账字段**：在类字段加 `private lastRevealEliminatedId: string | null = null;`（纳入 saveState/ensureLoaded）。`enterReveal(eliminatedId,...)` 里 `this.lastRevealEliminatedId = eliminatedId`。重写 `advanceAfterReveal` 开头：

```ts
const eid = this.lastRevealEliminatedId;
const role: Role | null = eid ? (eid === this.undercoverId ? "undercover" : "civilian") : null;
const winner = checkWin(role, this.aliveIds().length);
```
（删除 `phaseWasElimination` 设想。）

- [ ] **Step 4: 实现 `endGame`**

```ts
private async endGame(winner: Winner) {
  this.phase = "ended";
  this.phaseDeadline = 0;
  const roles: Record<string, Role> = {};
  for (const id of this.joinOrder) {
    roles[id] = id === this.undercoverId ? "undercover" : "civilian";
  }
  await this.saveState();
  this.broadcast({
    type: "gameOver",
    winner,
    undercoverId: this.undercoverId!,
    civilianWord: this.civilianWord!,
    undercoverWord: this.undercoverWord!,
    roles,
  });
}
```

- [ ] **Step 5: `alarm()` 追加 voting/reveal 超时分支**

```ts
// 在 Task 13 的 phaseDeadline 分支内补：
if (this.phase === "voting") {
  await this.tallyAndResolve(); // 超时按已投的票计（弃票忽略）
}
if (this.phase === "reveal") {
  await this.advanceAfterReveal();
}
```

- [ ] **Step 6: 实现中途离开/掉线（游戏中按出局）—— 完成 `processActualLeave` 全分支**

```ts
private async processActualLeave(dp: DisconnectedPlayer) {
  const wasAlive = this.aliveIds().includes(dp.id);
  const wasHost = dp.id === this.hostId;
  this.joinOrder = this.joinOrder.filter((id) => id !== dp.id);
  this.eliminatedIds = this.eliminatedIds.filter((id) => id !== dp.id);
  this.votes = Object.fromEntries(
    Object.entries(this.votes).filter(([v, t]) => v !== dp.id && t !== dp.id),
  );

  const remaining = [
    ...this.getJoinedWebSockets().map((r) => r.player.id),
    ...Array.from(this.disconnectedPlayers.keys()),
  ];
  if (remaining.length === 0) {
    await this.resetEmptyRoom();
    return;
  }
  // 房主迁移
  if (wasHost) {
    this.hostId = this.joinOrder.find((id) => this.isPlayerActive(id)) ?? remaining[0];
  }

  const inGame = this.phase === "describing" || this.phase === "voting" || this.phase === "reveal";
  if (inGame && wasAlive) {
    // 按出局处理：公开身份 + 重算胜负
    const role: Role = dp.id === this.undercoverId ? "undercover" : "civilian";
    this.broadcast({ type: "playerLeft", playerId: dp.id, revealedRole: role });
    const winner = checkWin(role, this.aliveIds().length);
    if (winner) {
      await this.endGame(winner);
      return;
    }
    // 游戏继续：修复当前阶段
    await this.fixupPhaseAfterRemoval(dp.id);
  } else {
    this.broadcast({ type: "playerLeft", playerId: dp.id });
    await this.saveState();
  }
}

/** 离开者影响当前阶段时的修复：描述阶段重建发言序；投票阶段检查是否已可计票。 */
private async fixupPhaseAfterRemoval(removedId: string) {
  if (this.phase === "describing") {
    const curId = this.speakingOrder[this.currentSpeakerIndex];
    // 从发言序移除离开者
    const wasCurrent = curId === removedId;
    this.speakingOrder = this.speakingOrder.filter((id) => id !== removedId);
    if (this.currentSpeakerIndex >= this.speakingOrder.length) {
      // 离开者在末尾或之后导致越界 → 本轮发言已结束
      this.enterVoting();
    } else if (wasCurrent) {
      // 离开者正好是当前发言者：当前 index 现指向原下一个，重置 deadline 并广播
      this.phaseDeadline = Date.now() + TURN_MS;
      this.scheduleNextAlarm();
      this.broadcast({
        type: "turnChange",
        currentSpeakerId: this.speakingOrder[this.currentSpeakerIndex],
        deadline: this.phaseDeadline,
      });
    } else {
      // 调整 index 保持指向同一个「当前发言者」
      const idx = this.speakingOrder.indexOf(curId);
      if (idx >= 0) { this.currentSpeakerIndex = idx; }
    }
    await this.saveState();
  } else if (this.phase === "voting") {
    const alive = this.aliveIds();
    if (alive.length > 0 && alive.every((id) => this.votes[id] !== undefined)) {
      await this.tallyAndResolve();
    } else {
      await this.saveState();
    }
  } else {
    await this.saveState();
  }
}

private async resetEmptyRoom() {
  this.created = false;
  this.phase = "lobby";
  this.hostId = null;
  this.joinOrder = [];
  this.civilianWord = this.undercoverWord = this.undercoverId = null;
  this.eliminatedIds = [];
  this.round = 0;
  this.speakingOrder = [];
  this.currentSpeakerIndex = 0;
  this.descriptions = [];
  this.votes = {};
  this.voteRound = 1;
  this.tiebreakCandidates = [];
  this.phaseDeadline = 0;
  this.lastRevealEliminatedId = null;
  this.chatHistory = [];
  this.disconnectedPlayers.clear();
  this.lastActivityAt = 0;
  await this.saveState();
}
```

- [ ] **Step 7: 验证 + Commit**

Run: `cd worker && npx tsc --noEmit` && `npx vitest run`
```bash
git add -A && git commit -m "feat(room): 投票计票/加赛/出局/公布/胜负，中途离开按出局与房主迁移"
```

---

### Task 15: `nextGame` —— 再来一局

**Files:** Modify: `worker/src/room.ts`

- [ ] **Step 1: switch 追加** `case "nextGame": await this.onNextGame(ws); break;`
- [ ] **Step 2: 实现**

```ts
private async onNextGame(ws: WebSocket) {
  const player = this.getPlayer(ws);
  if (!player || player.id !== this.hostId) { return; }
  if (this.phase !== "ended") { return; }
  this.phase = "lobby";
  this.civilianWord = this.undercoverWord = this.undercoverId = null;
  this.eliminatedIds = [];
  this.round = 0;
  this.speakingOrder = [];
  this.currentSpeakerIndex = 0;
  this.descriptions = [];
  this.votes = {};
  this.voteRound = 1;
  this.tiebreakCandidates = [];
  this.phaseDeadline = 0;
  this.lastRevealEliminatedId = null;
  await this.saveState();
  this.broadcast({ type: "phaseChange", phase: "lobby", round: 0 });
}
```

- [ ] **Step 3: 验证 + Commit** — `npx tsc --noEmit`；`git commit -am "feat(room): nextGame 再来一局回到大厅"`

---

## Phase 5：前端

### Task 16: `useWebSocket` + `App` + `Home`

**Files:** Create: `src/hooks/useWebSocket.ts`, `src/App.tsx`, `src/pages/Home.tsx`; Modify: `src/main.tsx`

- [ ] **Step 1: `useWebSocket.ts`**：逐字移植 draw-guess，仅把 `PLAYER_ID_KEY` 改为 `"undercover-playerId"`。
- [ ] **Step 2: `App.tsx`**：移植 draw-guess 结构并精简——状态机 `view: "home" | "room"`；昵称弹窗；`roomCode` + `playerName` + sessionStorage 的 playerId 恢复；`history.replaceState` 处理 URL；渲染 `Home` 或 `Room`。去掉画猜相关。`main.tsx` 末尾改回 `render(<App/>)`。
- [ ] **Step 3: `Home.tsx`**：昵称输入 + 「创建房间」（人数选择 3-6 → `POST /api/rooms?max=N` → 拿 roomCode → 进房）+ 「加入房间」（输 6 位房间号 → 进房）。用 Linear token 样式。API 调用用 `apiUrl`。
- [ ] **Step 4: 验证 + Commit**

Run: `npm run dev` → 首页可输昵称、建房（网络面板看到 `/api/rooms` 200 返回 roomCode）、加房输入框校验 6 位。
```bash
git add -A && git commit -m "feat(ui): useWebSocket 移植 + 首页建房/加入"
```

---

### Task 17: `Room.tsx` 消息分发骨架（ref 模式）+ 阶段路由

**Files:** Create: `src/pages/Room.tsx`

- [ ] **Step 1: 用 ref 模式实现 listener（关键，参考 draw-guess 经验，不要用依赖数组）**

```tsx
// 核心结构（样式从略，用 Linear token 补全）
export default function Room({ roomCode, playerName, playerId, onLeave }: RoomProps) {
  const { connected, send, addListener, leave } = useWebSocket(roomCode, playerName, playerId);
  const [state, setState] = useState<RoomView | null>(null); // 聚合服务端状态
  const [toast, setToast] = useState<string | null>(null);
  const messageHandlerRef = useRef<(m: ServerMessage) => void>(() => {});

  // 每次 render 重新赋值最新闭包（闭包语义自动看到最新 state）
  messageHandlerRef.current = (msg: ServerMessage) => {
    switch (msg.type) {
      case "roomState": /* setState 全量；存 sessionStorage(yourId) */ break;
      case "playerJoined": case "playerLeft": /* 更新 players（playerLeft 带 revealedRole 时弹 toast） */ break;
      case "gameStarted": /* 存 yourWord + 进入 describing 视图 */ break;
      case "phaseChange": /* 切 phase + 相关字段 */ break;
      case "turnChange": /* 更新 currentSpeakerId/deadline */ break;
      case "describeUpdate": /* 追加描述 */ break;
      case "voteUpdate": /* 标记已投 */ break;
      case "voteResult": /* 展示票数/出局者；tiebreak 则提示加赛 */ break;
      case "gameOver": /* 切 ended 视图，存 roles/词 */ break;
      case "chat": /* 追加聊天 */ break;
      case "error": setToast(msg.message); break;
      case "roomClosed": /* setJoinError + 1.5s 后 onLeave */ break;
    }
  };

  useEffect(() => {
    const off = addListener((m) => messageHandlerRef.current(m));
    return off;
  }, [addListener]); // 注册一次

  // 渲染：!myId||joinError → 错误屏；已加入后断线只显示重连 banner，不卸载主 UI
  // 按 state.phase 路由到 <Lobby/> / 描述视图 / 投票视图 / <RevealOverlay/> / <GameOver/>
}
```

- [ ] **Step 2: join 超时兜底 + joinError 统一退出 effect**：移植 draw-guess Room.tsx 的 `hasJoinedOnceRef`（首次 10s 未拿到 roomState → joinError → 1.5s 退出；重连场景跳过）与「joinError 统一 1.5s 后 onLeave」effect。
- [ ] **Step 3: 验证 + Commit**

Run: `npm run dev`（两个标签页各建/加同一房间，确认 roomState 同步、聊天互通、重连 banner 行为）。
```bash
git add -A && git commit -m "feat(ui): Room 消息分发（ref 模式）与阶段路由骨架"
```

---

### Task 18: 大厅 `Lobby`

**Files:** Create: `src/components/Lobby.tsx`

- [ ] **Step 1: 实现**：显示房间号（点击复制 + 提示）、玩家列表（房主标记）、当前/上限人数；房主可调人数（仅 UI 上限提示，真正上限在建房时定）、「开始游戏」按钮（`send({type:"startGame"})`，在场 <3 时禁用并提示「还差 N 人」）。非房主显示「等待房主开始」。Linear token 样式。
- [ ] **Step 2: 验证 + Commit**：`npm run dev` 3 个标签页进同一房间，房主可见开始按钮（≥3 可点），点开始后全部进入描述视图。`git commit -am "feat(ui): 大厅（房间号/玩家列表/人数/开始）"`

---

### Task 19: 描述视图 `WordCard` + `PlayerList` + `DescribePanel`

**Files:** Create: `src/components/WordCard.tsx`, `src/components/PlayerList.tsx`, `src/components/DescribePanel.tsx`

- [ ] **Step 1: `WordCard`**：大字展示 `yourWord`；出局后展示「你已出局（观战中）」。**不显示身份**。
- [ ] **Step 2: `PlayerList`**：玩家头像/名；当前发言者高亮 + 倒计时（基于 `deadline`）；出局者置灰 + 标记；投票阶段显示「已投票」徽标（来自 votedPlayerIds）。复用于描述/投票两视图。
- [ ] **Step 3: `DescribePanel`**：已发言记录（按 round 过滤本轮，显示 `玩家名: 描述`）；轮到自己时显示输入框（`maxLength=50`）+ 提交（`send({type:"describe",text})`）；非自己回合显示「等待 X 描述…」。
- [ ] **Step 4: 验证 + Commit**：3 人对局轮流描述，超时自动跳过（等 60s 或调小 TURN_MS 验证），轮完进入投票。`git commit -am "feat(ui): 描述视图（词卡/玩家列表/轮流描述）"`

---

### Task 20: 投票视图 `VotePanel`

**Files:** Create: `src/components/VotePanel.tsx`

- [ ] **Step 1: 实现**：列出存活玩家（加赛时仅 `tiebreakCandidates`），点选投票（`send({type:"vote",targetId})`，不能投自己/已出局）；投票后锁定显示「已投票」+ 倒计时；加赛时顶部提示「平票，请重新投票」。
- [ ] **Step 2: 验证 + Commit**：制造唯一最高票 → 有人出局；制造平票 → 触发加赛 → 再平票 → 无人淘汰进入下一轮。`git commit -am "feat(ui): 投票视图（含加赛提示）"`

---

### Task 21: `RevealOverlay` + `GameOver`

**Files:** Create: `src/components/RevealOverlay.tsx`, `src/components/GameOver.tsx`

- [ ] **Step 1: `RevealOverlay`**：reveal 阶段覆盖层，展示出局者名 + 身份（平民/卧底）揭晓动画；无人淘汰时显示「本轮无人出局」。约 5s 后由服务端 phaseChange 切走。
- [ ] **Step 2: `GameOver`**：胜负大字（平民胜/卧底胜）、卧底是谁、两个词、每人身份与词；房主显示「再来一局」（`send({type:"nextGame"})`），非房主显示「等待房主」。
- [ ] **Step 3: 验证 + Commit**：完整跑通 3 人局（一轮定胜负）与 4 人局（两轮）。`git commit -am "feat(ui): 出局揭晓与结算（再来一局）"`

---

### Task 22: `ChatPanel` + `Toast`

**Files:** Create: `src/components/ChatPanel.tsx`, `src/components/Toast.tsx`

- [ ] **Step 1: `Toast`**：移植 draw-guess（右上角滑入、3s 消失、点击关闭、`key` 强制 remount）。
- [ ] **Step 2: `ChatPanel`**：常驻聊天（describing/voting/reveal 可用），输入 `maxLength=200`，`send({type:"chat",text})`；展示 chatHistory + 实时 chat。
- [ ] **Step 3: 验证 + Commit**：聊天互通、错误（如游戏已开始加入）弹 Toast。`git commit -am "feat(ui): 常驻聊天与错误 Toast"`

---

## Phase 6：联调、部署、文档

### Task 23: 全流程联调 + 类型/Lint 收口

- [ ] **Step 1**：本地起 `wrangler dev` + 前端改 `VITE_API_BASE=http://localhost:8787`，开 4 个标签页跑完整局：建房→加入→开始（验证 DeepSeek 命中或兜底）→描述→投票→出局→胜负→再来一局；中途关一个标签验证「按出局 + 重算胜负」与房主迁移；刷新一个标签验证重连恢复（含 yourWord）。
- [ ] **Step 2**：`npx tsc --noEmit`（根 + worker）、`npm run lint`、`cd worker && npx vitest run` 全绿，修掉所有错误。
- [ ] **Step 3: Commit** — `git commit -am "test: 全流程联调通过，类型/lint/单测收口"`

### Task 24: GitHub Actions + 部署配置

**Files:** Create: `.github/workflows/deploy-pages.yml`, `.github/workflows/deploy-worker.yml`, `README.md`

- [ ] **Step 1**：移植 draw-guess 两个 workflow，改：Pages `project-name=undercover`；Worker 部署目录 `worker/`；触发路径 `worker/**` → worker 部署，其余 → pages。
- [ ] **Step 2**：写 `README.md`（人类向：玩法简介、本地开发、部署、域名）。
- [ ] **Step 3: Commit** — `git commit -am "ci: Pages/Worker 部署 workflow 与 README"`

### Task 25: 上线

- [ ] **Step 1**：`git remote add origin https://github.com/bello96/undercover.git` → push（**需用户确认后执行 push**）。
- [ ] **Step 2**：Cloudflare 配置（需用户操作或授权）：创建 Pages 项目 `undercover` 绑定域名 `undercover.dengjiabei.cn`；Worker 配 route；`cd worker && npx wrangler secret put DEEPSEEK_API_KEY`；GitHub 仓库配 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets。
- [ ] **Step 3**：线上 4 人对局验收（对照 spec §14 Definition of Done）。

---

## 自检（Self-Review 结果）

- **Spec 覆盖**：§3 规则→Tasks 5-8/12-15；§4 状态机→Tasks 11-15；§5 发词→Tasks 8-9/12；§6 协议→Task 4；§7 重连→Tasks 11/16-17；§8 页面→Tasks 16-22；§9 Linear→Task 3；§10 常量→Task 2；§11 部署→Tasks 24-25。无遗漏。
- **类型一致性**：`GamePhase`/`Role`/`Winner` 在 protocol.ts 与 worker/types.ts 双写一致；消息 type 字面量前后端一致；`game.ts` 函数签名（`pickUndercover`/`computeSpeakingOrder`/`tallyVotes`/`checkWin`/`parseWordPair`/`pickFallback`）在 Tasks 5-9 定义、Tasks 12-14 调用处一致。
- **占位符**：reveal 记账以 `lastRevealEliminatedId` 字段落定（Task 14 Step 3），无 TODO 残留；wordbank ≥50 对需实现时补足（已标注）。
- **已知人工依赖**：Linear DESIGN.md 抓取（Task 3）、DeepSeek key 与 Cloudflare 域名/secret（Task 25）需用户侧操作或授权。
