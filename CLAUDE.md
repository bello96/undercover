# CLAUDE.md

本文件为 AI 助手（Claude Code 等）提供该仓库的上下文。人类阅读请看 `README.md`。
**完整设计契约见 `docs/superpowers/specs/2026-05-29-undercover-game-design.md`（权威来源，本文件与其冲突时以 spec 为准）。**

> 项目：**🕵️ 谁是卧底** · 在线多人实时推理游戏（3–6 人，1 卧底）
> 线上（规划）：https://undercover.dengjiabei.cn
> 仓库（规划）：https://github.com/bello96/undercover
> 状态：**初始开发中**（脚手架与玩法尚未实现，本文件描述的多为规划结构）

---

## 一、项目速览

- **玩法**：无需登录。建房得 6 位房间号 → 他人凭号加入 → 房主设人数(3-6)、人满≥3 可开始 → 系统发词（N−1 人同词、1 人卧底词）→ 多轮「轮流描述 → 投票 → 出局」直至分胜负。
- **前端**：React 18 + TypeScript + Vite + Twind（CSS-in-JS Tailwind）
- **后端**：Cloudflare Workers + Durable Objects（Hibernatable WebSocket + SQLite backend），一个房间 = 一个 DO
- **实时通信**：WebSocket JSON 消息（服务端权威，客户端被动同步）
- **词来源**：**DeepSeek（默认）→ 内置词库（兜底）**，服务端调用，key 走 Worker secret，玩家零配置
- **设计系统**：**Linear**（`DESIGN.md` 放项目根，驱动 UI）
- **部署**：GitHub Actions → Cloudflare Pages（前端）+ Workers（后端）
- **单仓库两个包**：根目录是前端，`worker/` 是后端，各自 `package.json` 与 `tsconfig.json`
- **底座来源**：复用同目录 `../draw-guess`（我画你猜）的房间/实时/重连/部署骨架，**只重写玩法状态机**。

---

## 二、目录结构（规划）

```
├── DESIGN.md                     # Linear 设计系统，UI 视觉契约
├── src/                          # 前端
│   ├── main.tsx                  # 入口 + Twind install（Linear 主题 token）
│   ├── App.tsx                   # 顶层路由（首页 / 昵称弹窗 / 房间）
│   ├── api.ts                    # apiUrl / wsUrl
│   ├── pages/{Home,Room}.tsx     # 首页（建/加房）/ 主游戏页（消息分发 + 阶段渲染）
│   ├── components/
│   │   ├── Lobby.tsx             # 大厅：房间号、玩家列表、人数设置、开始
│   │   ├── WordCard.tsx          # 「你的词」卡片
│   │   ├── PlayerList.tsx        # 玩家列表（发言高亮 / 存活·出局 / 投票态）
│   │   ├── DescribePanel.tsx     # 轮流描述输入 + 已发言记录
│   │   ├── VotePanel.tsx         # 投票交互 + 倒计时
│   │   ├── RevealOverlay.tsx     # 出局揭晓动画
│   │   ├── GameOver.tsx          # 结算（胜负 + 揭晓 + 再来一局）
│   │   ├── ChatPanel.tsx         # 常驻聊天
│   │   └── Toast.tsx             # 错误/提示
│   ├── hooks/useWebSocket.ts     # WS 连接、重连、心跳、leave/pagehide
│   └── types/protocol.ts         # ⭐ 前后端共享消息契约
├── worker/
│   ├── src/
│   │   ├── index.ts              # HTTP 入口 + 路由到 DO + Origin 白名单
│   │   ├── room.ts               # ⭐ GameRoom Durable Object（状态机 + handlers）
│   │   ├── words.ts              # WordProvider：DeepSeek 调用 + 解析 + 6s 超时兜底
│   │   ├── wordbank.ts           # 内置精选词对库（≥50 对）
│   │   ├── types.ts              # DO 内部类型
│   │   ├── constants.ts          # 所有可调参数 + PROTOCOL_VERSION
│   │   └── helpers.ts            # 纯函数 helpers
│   └── wrangler.toml             # durable_objects + routes（undercover.dengjiabei.cn/api/*）
└── .github/workflows/            # deploy-pages.yml / deploy-worker.yml
```

---

## 三、游戏规则（核心）

### 角色与发词
- N 人 = **N−1 平民**（词 A）+ **1 卧底**（词 B）。A/B 相近但有别（周杰伦/林俊杰、苹果手机/华为手机）。
- **玩家只看到自己的词，看不到自己身份**，靠推理判断；**出局时才公开身份**。UI 不得提前暴露身份与对方词。
- v1 固定 **1 卧底，无白板**。

### 回合
每轮：**①描述**（存活者按序逐个提交一句 ≤50 字，实时可见）→ **②投票**（存活者同时投，不能投自己）→ **③公布**（最高票出局亮身份，判胜负，否则下一轮）。

### 已定规则
| 规则 | 取值 |
|---|---|
| 每轮首发言者 | 每轮随机一名存活者，其余按座位（加入）顺序 |
| 平票 | 对并列者**加赛一次**；仍平票则**本轮无人淘汰** |
| 投自己 | 不能 |
| 防挂机 | 发言 60s 超时跳过；投票 30s 超时弃票 |
| 中途离开 | grace 内可重连；超时按**出局**亮身份并重算胜负 |
| 开始条件 | maxPlayers(3-6) 为加入上限；**在场 ≥3 房主即可开始** |

### 胜负（每次出局后立即判，按序）
1. 出局者是卧底 → **平民胜**
2. 否则存活 == 2 → **卧底胜**
3. 否则继续下一轮
（推论：3 人局一轮定胜负。）

---

## 四、状态机（`GamePhase`）

```
lobby → (startGame: 发词+分配) → describing → voting → reveal → ended
                                      ↑__________________________|（未分胜负，下一轮）
                                                          ended →（nextGame）→ lobby
```
- **所有阶段流转只在 `room.ts` 服务端发生**，客户端被动同步。
- 发言 60s / 投票 30s / 公布 5s 三个计时统一用 DO **`alarm()`** 实现（进入阶段设 deadline + setAlarm，超时执行）。客户端用 deadline 仅作倒计时显示，不做权威判定。
- 词生成 6s 超时用 `fetch` + `AbortSignal.timeout`，不走 alarm。

详见 spec §4。

---

## 五、通信协议（`src/types/protocol.ts`，前后端共享）

`PROTOCOL_VERSION = 1`，双写前后端，**breaking 才 bump**（删消息/删必填/改语义）。

- **C→S**：`join` / `startGame` / `describe(text)` / `vote(targetId)` / `chat(text)` / `nextGame` / `leave` / `ping`
- **S→C**：`roomState` / `playerJoined` / `playerLeft(revealedRole?)` / `gameStarted(yourWord)` / `phaseChange` / `turnChange(currentSpeakerId,deadline)` / `describeUpdate(playerId,text,round)` / `voteUpdate(voterId)` / `voteResult(tally,eliminatedId,eliminatedRole?,tiebreak?)` / `gameOver(winner,undercoverId,civilianWord,undercoverWord,roles)` / `chat` / `error` / `roomClosed` / `pong`

**关键约束**：
- `gameStarted.yourWord` 必须**逐 ws 个性化**下发，每人只收自己的词（复用 draw-guess 给画手单独发 answer 的模式）。
- `voteUpdate` **只告知谁投了，不暴露票向**。
- 任何 `S→C` 消息**绝不包含**：对方的词、未出局者的身份、DeepSeek key。

---

## 六、词生成（DeepSeek + 兜底）

1. `startGame` → 服务端 `words.ts` 调 DeepSeek Chat Completions，要求返回 JSON `{civilianWord, undercoverWord}`（中文、相近可辨、各 ≤8 字、不同）。
2. `fetch` 带 `AbortSignal.timeout(6000)`。**超时/网络错误/非2xx/解析失败/校验不过 → 回退内置词库**。
3. 内置库 `wordbank.ts` 随机抽，避免同房间近期重复。
4. `DEEPSEEK_API_KEY` 用 `wrangler secret put` 配置，**仅服务端用，绝不下发前端**。

---

## 七、关键设计要点（复用 draw-guess 经验，开发前必读）

> 这些是 draw-guess 踩过的坑或固化约束，迁移时照搬。

1. **Hibernatable WebSocket**：`acceptWebSocket` 后 DO 可被回收，唤醒用 `getWebSockets()` 恢复；玩家身份存 **ws attachment**（`serializeAttachment`）跨休眠保留。
2. **状态持久化分层**：ws attachment 存玩家身份（id/name/isHost）；DO storage 存房间元数据（phase/词/身份/描述/投票/chatHistory）；`ensureLoaded()` 懒加载，`saveState()` 写回。
3. **断线/重连两级 grace**：正常断线 30s / `pagehide` sendBeacon 5s / 主动 leave 即时；`alarm()` 统一处理超时。
4. **身份恢复**：前端 `roomState` 后存 `sessionStorage(playerId)`，重连携带；服务端 `onJoin` 走 `disconnectedPlayers` 恢复或旧 ws take-over。
5. **`Room.tsx` listener 用 ref 模式**：`messageHandlerRef` 持最新闭包，注册一次永不卸载，避免重渲染丢消息（曾导致卡「连接中」）。**不要改回依赖数组 + 匿名函数**。
6. **房间号 409 冲突重试**：parent Worker 循环换码最多 5 次。
7. **服务端 storage 写入节流**：高频消息（如 chat）`touchActivity` 节流持久化（≥30s 才落盘），grace 路径不节流。
8. **协议版本号双写**：`protocol.ts` 与 `worker/src/constants.ts` 必须一致；客户端 `join` 带 `v`，服务端校验不匹配则 close。
9. **Origin 白名单 + rate limit**：所有 API/WS upgrade 走 `isAllowedOrigin()` 闸门；缺 Origin header 一律 403。每 ws 1s 窗口限流。

本游戏新增注意：
10. **服务端权威发词**：身份/对方词只存服务端，前端永远推不出来（直到 `gameOver`）。
11. **alarm 多用途复用**：发言超时 / 投票超时 / reveal 停留 / grace 清理 / inactivity 都靠同一个 `alarm()`，进入时 `scheduleNextAlarm()` 取最近 deadline。改动计时逻辑时注意别互相覆盖。
12. **出局/胜负判定集中**：所有「有人离场」入口（投票出局 / 中途离开 / grace 超时）都要走同一个 `checkWinCondition()`，避免分散导致状态不一致。

---

## 八、开发规范（遵循全局 CLAUDE.md）

- **Git commit message 必须中文**（`feat:`/`fix:`/`style:` 前缀保留英文，描述部分中文）；commit 末尾加 `合作：Claude Code Opus`（不要 `Co-Authored-By` 英文格式）。
- 所有 `if` 语句**强制带 `{}`**（ESLint `curly: error`）。
- 优先 TypeScript，严格模式；公开 API 必须有类型注解。
- 提交前跑 `npx tsc --noEmit`（前端 + worker）+ `npm run lint`，修完所有 TS/ESLint 错误再算完成。
- 响应用户一律**中文**，技术术语保留英文。
- 装包若遇 `@twind/core` peer 冲突，加 `--legacy-peer-deps`（沿用 draw-guess）。

### 本地开发
```bash
npm run dev                 # 前端（默认连线上 Worker）
cd worker && npx wrangler dev   # 本地 Worker（需 wrangler 登录 + 改 VITE_API_BASE）
```

### 部署
- 推 `master`：改 `worker/**` → 触发 Worker 部署；其余 → 触发 Pages 部署。
- Secret：`cd worker && npx wrangler secret put DEEPSEEK_API_KEY`。
- GitHub Secrets：`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。

---

## 九、参数（`worker/src/constants.ts`，初定）

`MIN_PLAYERS=3` · `MAX_PLAYERS=6` · `MAX_NAME_LENGTH=10` · `MAX_DESCRIBE_LENGTH=50` · `MAX_CHAT_LENGTH=200` · `TURN_MS=60000` · `VOTE_MS=30000` · `REVEAL_MS=5000` · `WORD_GEN_TIMEOUT_MS=6000` · grace 30000/5000 · `PROTOCOL_VERSION=1`

> 客户端各 input 的 `maxLength` 必须与服务端常量一致。

---

## 十、非目标（YAGNI）

语音 / 白板角色 / 多卧底 / 登录账号 / 战绩排行 / 房主自定义词 / 玩家自配 key / 观战 / 移动端专属布局，**v1 一律不做**。

---

## 十一、修改某区域时的入口

| 我想做… | 先看这里 |
|---|---|
| 加一种 WS 消息 | `src/types/protocol.ts` → `worker/src/room.ts:webSocketMessage` → `src/pages/Room.tsx` 消息分发 |
| 改阶段流转/计时 | `worker/src/room.ts` 的阶段 handler + `alarm()` + `constants.ts` |
| 改发词逻辑 | `worker/src/words.ts`（DeepSeek + 超时）+ `wordbank.ts`（兜底库） |
| 改胜负规则 | `worker/src/room.ts:checkWinCondition` |
| 改断线/重连 | `src/hooks/useWebSocket.ts` + `room.ts` 的 `onJoin`/`onDisconnect`/`alarm` |
| 改 UI 样式 | 组件 `tx(...)`；主题 token 在 `src/main.tsx` 的 Twind install；视觉规范看根 `DESIGN.md` |
