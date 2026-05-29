# 谁是卧底（Undercover）· 设计文档（Spec）

> 在线多人「谁是卧底」网页小游戏 · 无需登录 · 3–6 人实时联机
> 线上（规划）：https://undercover.dengjiabei.cn
> 仓库（规划）：https://github.com/bello96/undercover
> 日期：2026-05-29

本文件是经头脑风暴确认后的设计契约，作为实现计划（plan）与 `CLAUDE.md` 的依据。

---

## 1. 项目概述

- **是什么**：在线版「谁是卧底」。第一个玩家创建房间得到 6 位房间号，其他玩家凭房间号加入；人满后房主开始；系统给每人发一个词（N−1 人同词、1 人卧底词），多轮「轮流描述 → 投票 → 出局」直至分出胜负。
- **目标用户体验**：打开网页 → 输昵称 → 建/加房 → 玩，**全程无需注册登录**。
- **游玩模式**：**在线远程**——每人各自设备，描述/投票/聊天全部在网页内完成，可异地联机。
- **核心约束**：复用 `draw-guess` 的 Cloudflare 实时房间底座；UI 遵循 Linear 设计系统；词优先用 DeepSeek 生成，失败兜底内置词库；部署到 Cloudflare（Pages + Workers）。

---

## 2. 技术架构

### 2.1 选型（复用 draw-guess 底座）

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite + **Twind**（CSS-in-JS Tailwind） | 框架/构建照搬 draw-guess |
| 后端 | Cloudflare **Workers + Durable Objects**（Hibernatable WebSocket + SQLite backend） | 一个房间 = 一个 DO 实例 |
| 实时通信 | **WebSocket** JSON 消息 | 协议结构照搬，消息类型按本游戏重写 |
| 断线重连 | sessionStorage 存 playerId + 两级 grace period + `alarm()` 清理 | 照搬并适配「出局」语义 |
| 房间号 | 6 位数字 + `/init` 409 冲突重试（最多 5 次换码） | 照搬 |
| 安全 | Origin 白名单 + 每 ws rate limit + 输入长度硬限制 | 照搬 |
| 词生成 | **DeepSeek（默认）→ 内置词库（兜底）**，服务端调用，key 走 Worker secret | 新增模块 |
| 设计系统 | **Linear** `DESIGN.md`（放项目根，驱动 UI 生成） | 新增 |
| 部署 | GitHub Actions → Cloudflare Pages（前端）+ Workers（后端） | 复用 workflow，改项目名/域名 |

### 2.2 单仓库结构（规划）

```
undercover/
├── DESIGN.md                     # Linear 设计系统（来自 awesome-design-md），驱动 UI
├── CLAUDE.md                     # 给 AI 的仓库上下文（据本 spec 生成）
├── README.md
├── index.html
├── package.json / tsconfig.json / vite.config.ts
├── eslint.config.js / .prettierrc.json
├── src/                          # 前端
│   ├── main.tsx                  # 入口 + Twind install（Linear 主题 token）
│   ├── App.tsx                   # 顶层路由（首页 / 昵称 / 房间）
│   ├── api.ts                    # apiUrl / wsUrl
│   ├── pages/
│   │   ├── Home.tsx              # 创建 / 加入房间
│   │   └── Room.tsx              # 主游戏页，消息分发 + 阶段渲染
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
│   ├── hooks/
│   │   └── useWebSocket.ts       # WS 连接、重连、心跳、leave/pagehide（照搬）
│   └── types/protocol.ts         # ⭐ 前后端共享消息契约
├── worker/
│   ├── src/
│   │   ├── index.ts              # HTTP 入口 + 路由到 DO + Origin 白名单（照搬）
│   │   ├── room.ts               # ⭐ GameRoom Durable Object（状态机 + handlers）
│   │   ├── words.ts              # WordProvider：DeepSeek 调用 + 解析 + 兜底
│   │   ├── wordbank.ts           # 内置精选词对库
│   │   ├── types.ts              # DO 内部类型
│   │   ├── constants.ts          # 所有可调参数 + 协议版本号
│   │   └── helpers.ts            # 纯函数 helpers
│   └── wrangler.toml             # durable_objects + routes + DEEPSEEK secret 绑定
└── .github/workflows/            # deploy-pages.yml / deploy-worker.yml
```

---

## 3. 游戏规则

### 3.1 角色与发词（核心机制）

- N 人 = **N−1 平民**（拿词 A）+ **1 卧底**（拿词 B）。A/B 是一对**相近但有区别**的词（例：周杰伦 / 林俊杰，苹果手机 / 华为手机，香菜 / 芹菜）。
- **玩家只看到自己的词，看不到自己的身份**——靠描述与推理判断谁的词「不一样」。**出局时才公开该玩家身份**。这是本游戏的灵魂，UI 不得提前暴露身份。
- v1 **固定 1 名卧底，无「白板」角色**。

### 3.2 回合结构

每一轮（round）依次经历：

1. **描述**：按发言顺序，**存活**玩家逐个提交一句话描述（≤50 字，不能直接说出词）。所有人实时可见已发言内容。
2. **投票**：所有存活玩家同时投票，选出最可疑者（不能投自己）。
3. **公布**：得票最高者出局并公开身份；判定胜负；未分胜负则进入下一轮（所有存活者重新各描述一句）。

### 3.3 已确认的规则（设计决策）

| # | 规则 | 取值 |
|---|---|---|
| 1 | 每轮谁先发言 | **每轮随机**一名存活者先发，其余按座位（加入）顺序轮转 |
| 2 | 是否每轮都描述 | **是**，每轮所有存活者各说一句新描述 |
| 3 | 平票处理 | 对并列最高票者**加赛投票一次**（仅在这些候选人中选）；仍平票 → **本轮无人淘汰**，进入下一轮 |
| 4 | 能否投自己 | **不能** |
| 5 | 防挂机 | 发言 **60s** 倒计时，超时自动跳过并记「（未描述）」；投票 **30s** 倒计时，超时记弃票 |
| 6 | 中途掉线/离开 | grace 期内可重连；超时按**出局**处理并公开身份，随后走胜负判定 |
| 7 | 卧底胜利条件 | 存活人数降到 **2** 且卧底仍在场 → 卧底胜 |

### 3.4 胜负判定（每次有人出局后立即检查）

按顺序判定：

1. 若**出局者是卧底** → **平民胜**，游戏结束。
2. 否则若**存活人数 == 2** → **卧底胜**，游戏结束。
3. 否则（含平票无人淘汰）→ 继续下一轮。

> 推论：3 人局一轮定胜负（出局卧底则平民胜；出局平民则剩 2 人卧底胜）。投票只会在存活 ≥3 时发起，存活降到 2 必然已触发胜负，不会出现 2 人投票的尴尬。

---

## 4. 状态机

### 4.1 阶段（`GamePhase`）

```
lobby       等待玩家加入；房主可设人数(3-6，作为加入上限)；在场 ≥3 房主即可「开始」
  │ startGame（房主，服务端生成词对 + 随机分配身份）
  ▼
describing  轮流描述：currentSpeakerId 高亮 + turnDeadline 倒计时；
  │         当前玩家 describe 后顺延；所有存活者描述完 ↓
  ▼
voting      存活玩家投票（不能投自己）；全投完或 voteDeadline 到 → 计票
  │         · 平票且未加赛过 → 加赛（voteRound=2，仅候选人）
  ▼
reveal      公布出局者+身份（voteResult）；alarm 延时 REVEAL_MS 后：
  │           · 分出胜负 → ended
  │           · 否则 → 回 describing（下一轮，重选首发言者）
  ▼
ended       gameOver：揭晓全部身份与两个词；房主「再来一局」→ lobby
```

聊天区在 `describing` / `voting` / `reveal` 全程可用。

### 4.2 服务端权威 + alarm 驱动的计时

- **所有阶段流转只在 `room.ts` 服务端发生**，客户端被动同步（照搬 draw-guess「服务端权威」原则）。
- 计时（发言 60s / 投票 30s / 公布 REVEAL_MS）统一用 DO `alarm()` 实现：进入某阶段时设 deadline 并 `setAlarm`；`alarm()` 触发时若仍在该阶段则执行超时逻辑（跳过发言 / 强制计票 / 推进到下一阶段）。客户端只用 deadline 显示倒计时，不做权威判定。
- 词生成超时（6s）在 `startGame` 内用 `fetch` + `AbortSignal.timeout(6000)` 处理，不走 alarm。

### 4.3 describing 阶段细节

- 进入时：服务端从存活者里**随机**挑首发言者，按座位顺序生成本轮 `speakingOrder`；设 `currentSpeakerId` 与 `turnDeadline=now+60s`，`setAlarm`，广播 `phaseChange(describing)` + `turnChange`。
- 仅 `currentSpeakerId` 能 `describe(text)`；校验文本长度后记录本轮描述，广播 `describeUpdate`，推进到 `speakingOrder` 下一个存活者。
- 全部存活者描述完 → 进入 voting。
- 发言超时（alarm）：记「（未描述）」，广播 `describeUpdate`，推进。

### 4.4 voting 阶段细节

- 进入时：清空 votes，设 `voteDeadline=now+30s`，`setAlarm`，广播 `phaseChange(voting)`。
- 存活玩家 `vote(targetId)`：校验 target 存活且非自己；记 `votes[voterId]=targetId`；广播 `voteUpdate(voterId)`（**只告知谁投了，不暴露票向**）。
- 全部存活者投完 或 deadline 到 → 计票（弃票忽略）：
  - 唯一最高票 → 该玩家出局。
  - 并列最高票：
    - 若 `voteRound==1` → 进入加赛：广播 `voteResult{ eliminatedId:null, tiebreak:{ candidates, round:2 } }` + `phaseChange(voting)`（重置 deadline、`voteRound=2`），客户端据此**只在候选人中重投**。
    - 若 `voteRound==2` → **本轮无人淘汰**。
- 出局结果（或无人淘汰）定下后 → 进入 reveal，广播 `voteResult`。

### 4.5 reveal → 下一轮 / 结束

- 进入 reveal：广播 `voteResult`（票数 + 出局者 + 其身份 / 或「无人淘汰」），`setAlarm(now+REVEAL_MS)`。
- alarm 触发：执行 §3.4 胜负判定。
  - 分出胜负 → `phase=ended`，广播 `gameOver`。
  - 否则 → `phase=describing`，开新一轮（重选首发言者）。

### 4.6 中途离开 / 掉线（适配 draw-guess 机制）

- 复用 draw-guess 的 `disconnectedPlayers` + 两级 grace（正常断线 30s / 刷新关闭 5s）+ `alarm` 超时。
- **lobby 阶段**离开：直接移除玩家（同 draw-guess）。
- **游戏中**离开/grace 超时：按**出局**处理（标记出局 + 公开身份），再走 §3.4 胜负判定；若其为 currentSpeaker 则顺延发言；若在 voting 则其票作废。
- **房主离开**：把房主身份转移给最早加入的在场玩家（host migration）。
- **房间空**：alarm 清理并销毁（照搬）。

---

## 5. 词生成（DeepSeek + 内置兜底）

### 5.1 流程

1. 房主 `startGame` → 服务端进入「生成词语中…」（前端显示过渡态）。
2. 服务端 `words.ts` 调 **DeepSeek** Chat Completions：要求返回 JSON `{ "civilianWord": "...", "undercoverWord": "..." }`，约束：中文、二者相近可辨、适合谁是卧底、各 ≤8 字、不相同。
3. `fetch` 带 `AbortSignal.timeout(6000)`。**超时 / 网络错误 / 非 2xx / JSON 解析失败 / 校验不通过** → 任一发生即**回退内置词库**。
4. 拿到词对后随机决定哪个给卧底，分配身份并 `gameStarted` 个性化下发（见 §6）。

### 5.2 内置词库（`worker/src/wordbank.ts`）

- 手工精选 **≥50 对**中文词对（明星、食物、数码、生活物品、影视等类目）。
- 随机抽取，并尽量避免**同一房间近期重复**（DO 内存记最近 N 个已用 index）。

### 5.3 密钥与安全

- `DEEPSEEK_API_KEY` 用 `wrangler secret put DEEPSEEK_API_KEY` 配置，**仅服务端使用**，**绝不下发前端**，不写进任何 `S→C` 消息。
- 调用在 DO 内（`fetch`）完成；前端永远只收到「自己的词」，收不到对方的词与任何身份信息（直到 `gameOver`）。

---

## 6. 通信协议（`src/types/protocol.ts`，前后端共享）

带协议版本号 `PROTOCOL_VERSION = 1`（双写前后端，breaking 变更才 bump，照搬 draw-guess 约定）。

### 6.1 Client → Server

| type | 字段 | 说明 |
|---|---|---|
| `join` | `playerName`, `playerId?`, `v?` | 加入/重连 |
| `startGame` | — | 仅房主；触发发词与分配 |
| `describe` | `text` | 仅当前发言者；本轮描述 |
| `vote` | `targetId` | 存活玩家投票；不能投自己 |
| `chat` | `text` | 聊天 |
| `nextGame` | — | 仅房主；结算后再来一局，回 lobby |
| `leave` | — | 主动离开 |
| `ping` | — | 心跳 |

### 6.2 Server → Client

| type | 关键字段 | 说明 |
|---|---|---|
| `roomState` | `roomCode, players[], hostId, phase, maxPlayers, yourId, aliveIds[], currentSpeakerId?, turnDeadline?, voteDeadline?, descriptions?, votedPlayerIds?, yourWord?, chatHistory?` | 全量快照（重连恢复用；`yourWord` 仅含本人词） |
| `playerJoined` | `player` | 有人加入（lobby） |
| `playerLeft` | `playerId`, `revealedRole?` | 有人离开；**游戏中**离开时带 `revealedRole`（按出局公开身份），随后服务端重算胜负（可能紧跟 `gameOver`） |
| `gameStarted` | `yourWord`, `speakingOrder?`, `phase` | **逐 ws 个性化**：每人只收到自己的词 |
| `phaseChange` | `phase`, 阶段相关字段 | 阶段流转 |
| `turnChange` | `currentSpeakerId`, `deadline` | 轮到谁发言 |
| `describeUpdate` | `playerId`, `text`, `round` | 某人提交了描述 |
| `voteUpdate` | `voterId` | 某人已投票（**不含票向**） |
| `voteResult` | `tally{playerId:count}`, `eliminatedId\|null`, `eliminatedRole?`, `tiebreak?` | 计票结果 + 出局者身份 |
| `gameOver` | `winner("civilian"\|"undercover")`, `undercoverId`, `civilianWord`, `undercoverWord`, `roles{playerId:role}` | 揭晓全部 |
| `chat` | `playerId, playerName, text, timestamp` | 聊天广播 |
| `error` | `message` | 错误（前端 Toast） |
| `roomClosed` | `reason` | 房间关闭 |
| `pong` | — | 心跳回应 |

> **个性化下发**：`gameStarted` 的 `yourWord` 必须按 ws 分别发送（每个连接只发自己的词），复用 draw-guess 给「画手」单独发 answer 的模式。

---

## 7. 断线重连与连接管理

- 复用 draw-guess：身份存 ws attachment（跨 hibernation 保留）；房间元数据存 DO storage；`ensureLoaded()` 懒加载内存快照；`saveState()` 写回。
- 前端 `useWebSocket`：指数退避重连（识别 terminal close reason 不重连）+ 25s 心跳 + `pagehide` sendBeacon 快速离开。
- 前端 `roomState` 到达后把 `yourId` 存 `sessionStorage`，重连携带 `playerId` 走服务端 take-over / `disconnectedPlayers` 恢复分支。
- `Room.tsx` 的消息 listener 用 **ref 模式**（注册一次永不卸载），避免重渲染丢消息（照搬 draw-guess 关键经验）。

---

## 8. 前端页面与组件

| 屏幕 | 组件 | 内容 |
|---|---|---|
| 首页 | `Home` | 昵称输入 + 创建房间 / 输房间号加入 |
| 大厅 | `Lobby` | 房间号（可复制分享）、玩家列表、人数设置（房主，3-6，仅作加入上限）、开始按钮（房主，在场 ≥3 即可点；UI 提示「还差 N 人到设定人数」或「已满」） |
| 描述 | `WordCard` + `PlayerList` + `DescribePanel` + `ChatPanel` | 你的词卡、玩家列表（当前发言者高亮）、描述输入（轮到你时）、已发言记录、聊天 |
| 投票 | `PlayerList` + `VotePanel` + `ChatPanel` | 玩家列表 + 投票按钮 + 已投状态 + 倒计时 |
| 公布 | `RevealOverlay` | 出局者身份揭晓动画 + 存活情况 |
| 结算 | `GameOver` | 胜负、卧底揭晓、所有人的词、再来一局（房主） |

---

## 9. UI 设计（Linear 设计系统）

- 把 awesome-design-md 的 **Linear `DESIGN.md`** 放项目根，作为视觉契约：冷色调、精致渐变、紧凑布局、开发者审美。
- 在 `src/main.tsx` 的 Twind `install({ theme: { extend } })` 落地 Linear 的颜色/字体/圆角/阴影 token；组件统一用 token，不写内联 hex。
- 所有视觉相关代码须遵循 `DESIGN.md`；具体 token 值在实现阶段从该文档提取后固化到主题，并在 `CLAUDE.md` 记录。

---

## 10. 参数 / 常量（`worker/src/constants.ts`，初定可调）

| 常量 | 值 |
|---|---|
| `PROTOCOL_VERSION` | 1 |
| `MIN_PLAYERS` / `MAX_PLAYERS` | 3 / 6 |
| `MAX_NAME_LENGTH` | 10 |
| `MAX_DESCRIBE_LENGTH` | 50 |
| `MAX_CHAT_LENGTH` | 200 |
| `TURN_MS`（发言倒计时） | 60_000 |
| `VOTE_MS`（投票倒计时） | 30_000 |
| `REVEAL_MS`（公布停留） | 5_000 |
| `WORD_GEN_TIMEOUT_MS` | 6_000 |
| 正常断线 grace / 快速离开 grace | 30_000 / 5_000 |
| rate limit | 1s 窗口 / 每 ws 上限（沿用 draw-guess 量级） |

> 客户端各 input 的 `maxLength` 必须与服务端常量一致。

---

## 11. 部署

- **前端**：Cloudflare Pages，项目名 `undercover`，绑定域名 `undercover.dengjiabei.cn`。
- **后端**：Cloudflare Workers，`wrangler.toml` 配 `routes = undercover.dengjiabei.cn/api/*` + `GAME_ROOM` Durable Object 绑定 + `[[migrations]] new_sqlite_classes=["GameRoom"]`。
- **Secret**：`wrangler secret put DEEPSEEK_API_KEY`。
- **CI**：GitHub Actions（复用 draw-guess 的两个 workflow）：改 `worker/**` 触发 Worker 部署，其余触发 Pages 部署。
- **仓库**：https://github.com/bello96/undercover 。
- 需要的 GitHub Secrets：`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`（部署用），DeepSeek key 通过 `wrangler secret` 直接配在 Worker（不进 CI）。

---

## 12. 非目标（YAGNI / 明确不做）

- ❌ 语音描述 / 语音聊天（需 WebRTC，成本高，放 v1 之外）
- ❌ 「白板」角色、多卧底
- ❌ 用户注册 / 登录 / 账号体系 / 历史战绩
- ❌ 房主自定义词 / 玩家自配 LLM key（key 由开发者内置）
- ❌ 观战、好友、排行榜
- ❌ 移动端专属布局（先保证桌面端；响应式按 Linear 规范尽量适配，但不为移动端单独设计）

---

## 13. 实现顺序（供 plan 参考）

1. 脚手架：复用 draw-guess 配置（package/vite/tsconfig/eslint/prettier），放入 Linear `DESIGN.md`。
2. 后端房间骨架：DO + `join`/重连/大厅（先不含玩法），跑通建房/加入/人数设置。
3. 协议类型：`protocol.ts` 全量定义。
4. 玩法状态机：`startGame` → 发词 → describing → voting → reveal → ended（先用内置词库）。
5. 接入 DeepSeek + 6s 超时兜底。
6. 前端各阶段 UI（Linear 风格）+ 聊天 + Toast + 重连 banner。
7. 边界：平票加赛、中途离开按出局、房主迁移、防挂机超时。
8. 部署：wrangler + Pages + GitHub Actions + 域名 + secret。
9. 生成 `CLAUDE.md`。

---

## 14. 验收标准（Definition of Done）

- 3–6 人可建房/加入/设人数；房主可开始。
- 发词正确：N−1 同词 + 1 卧底词；每人只见己词；DeepSeek 失败能无感兜底内置库。
- 轮流描述（含超时跳过）→ 投票（含平票加赛）→ 出局揭晓 → 胜负判定，全流程正确。
- 胜负规则符合 §3.4；3 人局一轮定胜负。
- 断线可重连恢复；中途离开按出局正确处理；房主迁移正常。
- `npx tsc --noEmit`（前端 + worker）零错误；`npm run lint` 通过。
- 部署到 `undercover.dengjiabei.cn` 可正常多人对局。
