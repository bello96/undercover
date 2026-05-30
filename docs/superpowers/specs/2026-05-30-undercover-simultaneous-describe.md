# 谁是卧底 · 同时作答交互重设计（Simultaneous-Describe Redesign）

> 日期：2026-05-30
> **本文覆盖原始 spec（`2026-05-29-undercover-game-design.md`）中 §3「回合」、§4「状态机·describing」、§5「协议·turnChange/轮流描述」相关部分。其余（角色发词、胜负判定、断线重连、发词兜底、Origin/限流等）不变，仍以原 spec 为准。**

## 目标
- 描述阶段由「轮流逐个发言」→「会玩同款·几人**同时作答**」。
- 布局改为**左侧玩家卡网格 + 右侧常驻聊天**（参考 `../draw-guess`）。
- **Linear 暗色画风不变**；**卧底仍固定 1 个**。

## 已敲定的玩法决策
- **提交即可见（会玩同款）**：玩家提交描述后立即广播给所有人；提交后锁定不可改。
- **描述完直接进投票**：无独立讨论阶段；讨论靠右侧常驻聊天随时进行。
- 每人每轮**一句**（≤50 字）；超时未提交者显示「(未描述)」。

## 新流程
1. **大厅**（不变）：房主设人数、在场 ≥3 即可开始。
2. **开局发词**：N−1 平民同词、1 卧底异词；客户端弹「你的词语」浮层（短倒计时后归位）。
3. **描述 · 同时作答**：所有存活者在同一倒计时窗口（`DESCRIBE_MS=45s`）内各提交一句。
   - 提交即锁定，并**立即广播可见**。
   - **全员存活者提交 或 到点 → 自动进投票**。
4. **投票 · 同时**（机制不变）：各投一票、不能投自己；点头像投票；只公开「谁投了」，不公开票向。
5. **公布**（不变）：最高票出局亮身份并判胜负；平票加赛一次，仍平则无人淘汰。
6. 未分胜负 → 下一轮描述；否则结算。
7. 右侧聊天**全程常驻**。

## 状态机
`lobby → describing(同时) → voting → reveal → ended`（reveal 未分胜负回 describing）。
阶段枚举**不变**，仅 `describing` 语义变化：不再有 `currentSpeaker` / 发言序 / `turnChange`，改为「窗口内任意存活者各提交一次」。

## 协议变更（`PROTOCOL_VERSION 1 → 2`，破坏性，前后端双写）
- **删除** `S_TurnChange` 消息及客户端处理。
- `C_Describe { text }`：语义改为「任意存活者本轮提交一次」；服务端校验「describing 阶段 + 存活 + 本轮未提交过 + 非空」。
- `S_DescribeUpdate { playerId, text, round }`：每次提交即广播（实时可见），形状不变。
- `S_GameStarted`：移除 `currentSpeakerId` / `speakingOrder`，保留 `yourWord/round/deadline`。
- `S_PhaseChange`：移除 `currentSpeakerId` / `speakingOrder`，保留 `phase/round/deadline/tiebreakCandidates`。
- `S_RoomState`：移除 `currentSpeakerId` / `speakingOrder`；本轮「谁已作答 + 内容」由 `descriptions`（每轮清空）推导。
- 客户端「本轮我/谁已提交」均由 `descriptions` 按 `round` 推导，无需新增字段。

## 服务端 `worker/src/room.ts` 变更
- 删字段 `speakingOrder` / `currentSpeakerIndex`（含 `ensureLoaded`/`saveState`/`resetGameplayFields`）。
- `startDescribingRound()`：仅 `phase=describing` + `phaseDeadline=now+DESCRIBE_MS` + `scheduleNextAlarm`；不再算发言序。
- `onDescribe()`：校验通过 → 记录 + 广播 `describeUpdate`（实时）→ 若全员存活已提交则 `enterVoting()`，否则 `saveState()`。
- 删 `advanceSpeaker()` 与 `turnChange` 广播；`recordDescription()` 简化为 push + 广播（不推进）。
- `alarm()` 的 `describing` 分支：到点直接 `enterVoting()`（未提交者无条目）。
- `fixupPhaseAfterRemoval()` 的 `describing` 分支：移除离开者后，若剩余存活全已提交 → `enterVoting()`，否则 `saveState()`。
- `processActualLeave()`：顺带从 `descriptions` 过滤离开者条目。
- `buildRoomState` / `onStartGame`：去掉 `speakingOrder` / `currentSpeakerId`。

## 纯函数 `worker/src/game.ts`
- 删 `computeSpeakingOrder` + 其单测；`pickUndercover` / `tallyVotes` / `checkWin` / `parseWordPair` / `pickFallback` 不变。

## 常量 `worker/src/constants.ts`
- `PROTOCOL_VERSION = 2`。
- `TURN_MS`（每人 60s）→ `DESCRIBE_MS = 45_000`（整轮同时作答窗口）。

## 前端布局 / 组件
- **`Room.tsx`**：in-game（describing/voting/reveal）改双栏——左 `flex-1` 游戏主区 + 右 `w-[350px]` `ChatPanel`（lobby/ended 保持原全屏）。顶部条含 房号 / 轮次 / 阶段 / 倒计时 / 「N人·1卧底」/ 离开。删 `turnChange` 处理与 `currentSpeakerId`/`speakingOrder`。
- **`PlayerCards.tsx`（新）**：玩家卡网格，每卡 = 头像（昵称首字）+ 名 + 描述气泡：
  - **describing**：已提交→显示其描述；本人未提交→内嵌输入 + 发送；他人未提交→「✏️ 正在输入…」。
  - **voting**：卡可点投票（存活、非自己、合法目标），显示「已投票」徽标、本人选择高亮；描述继续显示供回看。
  - **reveal**：出局者卡亮身份（卧底/平民）。
- **`WordRevealOverlay.tsx`（新，轻量）**：`gameStarted` 时弹「你的词语 X」短倒计时后自动消失。
- **`WordCard.tsx`**：保留（常驻显示本人词）。
- **`ChatPanel.tsx`**：移至右侧 350px（沿用现样式/功能）。
- **删除**：`DescribePanel.tsx`、`PlayerList.tsx`、`VotePanel.tsx`（功能并入 `PlayerCards`）；`RevealOverlay.tsx` 保留为居中公布。

## 实现单元（顺序）
1. 协议 + 常量（版本 2、删 turnChange、describe 语义、`DESCRIBE_MS`）。
2. `game.ts`（删 `computeSpeakingOrder` + 测试）。
3. `room.ts`（同时作答状态机）。
4. worker `tsc` + `vitest` 验证。
5. 前端：`Room` 双栏 + `PlayerCards` + `WordRevealOverlay` + `ChatPanel` 右侧 + 删旧组件。
6. 前端 `tsc` + `lint`。
7. 构建、部署、线上验收。

## 非目标（不变）
多卧底 / 白板 / 独立讨论阶段 / 登录 / 移动端专属布局 —— v1 不做。
