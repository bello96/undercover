import {
  ACTIVITY_PERSIST_MIN_INTERVAL_MS,
  DESCRIBE_MS,
  INACTIVITY_TIMEOUT_MS,
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  MAX_DESCRIBE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROTOCOL_VERSION,
  QUICK_LEAVE_GRACE_MS,
  RATE_LIMIT_MAX_MSGS,
  RATE_LIMIT_WINDOW_MS,
  RECONNECT_GRACE_MS,
  REVEAL_MS,
  VOTE_MS,
} from "./constants";
import { checkWin, pickUndercover, tallyVotes } from "./game";
import { getWordPair } from "./words";
import type {
  ChatEntry,
  DescribeEntry,
  DisconnectedPlayer,
  Env,
  GamePhase,
  PlayerAttachment,
  Role,
  Winner,
} from "./types";

interface PlayerInfoWire {
  id: string;
  name: string;
  isHost: boolean;
  alive: boolean;
  ready: boolean;
}

// ============ GameRoom Durable Object ============

export class GameRoom implements DurableObject {
  // In-memory cache (restored from storage on wake)
  private loaded = false;
  private created = false;
  private roomCode = "";
  private maxPlayers = MIN_PLAYERS;
  private hostId: string | null = null;
  private joinOrder: string[] = [];
  private phase: GamePhase = "lobby";
  private chatHistory: ChatEntry[] = [];
  private readyIds: string[] = []; // 大厅已准备的非房主玩家（开局/重置时清空）
  private disconnectedPlayers = new Map<string, DisconnectedPlayer>();
  private lastActivityAt = 0;
  // touchActivity 节流：避免每条消息都 storage.put + setAlarm。
  // 仅当距离上次持久化超过 ACTIVITY_PERSIST_MIN_INTERVAL_MS 时才同步到 storage。
  // 不需要持久化此字段——DO 重启后从 0 开始，下次 touchActivity 会立即同步。
  private lastActivityPersistedAt = 0;

  // 玩法状态（游戏中才有意义；本单元只声明 + 读写持久化，handler 留待后续单元）
  private civilianWord: string | null = null;
  private undercoverWord: string | null = null;
  private undercoverId: string | null = null;
  private eliminatedIds: string[] = []; // 已出局（留房观战）
  private round = 0;
  private descriptions: DescribeEntry[] = []; // 当前轮已提交（每轮开始清空）
  private votes: Record<string, string> = {};
  private voteRound: 1 | 2 = 1;
  private tiebreakCandidates: string[] = [];
  private phaseDeadline = 0; // describing/voting/reveal 的 alarm 截止
  private recentWordIndices: number[] = []; // 内置库近期去重（内存即可，不持久化）
  // reveal 阶段当轮被投出者 ID（无人淘汰为 null），advanceAfterReveal 据此判 role；持久化以防休眠丢失
  private lastRevealEliminatedId: string | null = null;

  // Per-ws rolling window counter for rate limiting. WeakMap ensures the
  // entry is GC'd when the ws is collected, and hibernation resets it naturally.
  private wsMessageCounts = new WeakMap<WebSocket, { windowStart: number; count: number }>();

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  // ============ Restore state from storage after hibernation ============

  private async ensureLoaded() {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const data = await this.state.storage.get<unknown>([
      "created",
      "roomCode",
      "maxPlayers",
      "hostId",
      "joinOrder",
      "phase",
      "chatHistory",
      "readyIds",
      "disconnectedPlayers",
      "lastActivityAt",
      // 玩法字段
      "civilianWord",
      "undercoverWord",
      "undercoverId",
      "eliminatedIds",
      "round",
      "descriptions",
      "votes",
      "voteRound",
      "tiebreakCandidates",
      "phaseDeadline",
      "lastRevealEliminatedId",
    ]);

    this.created = (data.get("created") as boolean) ?? false;
    this.roomCode = (data.get("roomCode") as string) ?? "";
    this.maxPlayers = (data.get("maxPlayers") as number) ?? MIN_PLAYERS;
    this.hostId = (data.get("hostId") as string | null) ?? null;
    this.joinOrder = (data.get("joinOrder") as string[]) ?? [];
    this.phase = (data.get("phase") as GamePhase) ?? "lobby";
    this.chatHistory = (data.get("chatHistory") as ChatEntry[]) ?? [];
    this.readyIds = (data.get("readyIds") as string[]) ?? [];

    const dcRaw = data.get("disconnectedPlayers") as [string, DisconnectedPlayer][] | null;
    this.disconnectedPlayers = dcRaw
      ? new Map(dcRaw.map(([id, dp]) => [id, { ...dp, graceMs: dp.graceMs ?? RECONNECT_GRACE_MS }]))
      : new Map();
    this.lastActivityAt = (data.get("lastActivityAt") as number) ?? 0;

    // 玩法字段
    this.civilianWord = (data.get("civilianWord") as string | null) ?? null;
    this.undercoverWord = (data.get("undercoverWord") as string | null) ?? null;
    this.undercoverId = (data.get("undercoverId") as string | null) ?? null;
    this.eliminatedIds = (data.get("eliminatedIds") as string[]) ?? [];
    this.round = (data.get("round") as number) ?? 0;
    this.descriptions = (data.get("descriptions") as DescribeEntry[]) ?? [];
    this.votes = (data.get("votes") as Record<string, string>) ?? {};
    this.voteRound = (data.get("voteRound") as 1 | 2) ?? 1;
    this.tiebreakCandidates = (data.get("tiebreakCandidates") as string[]) ?? [];
    this.phaseDeadline = (data.get("phaseDeadline") as number) ?? 0;
    this.lastRevealEliminatedId = (data.get("lastRevealEliminatedId") as string | null) ?? null;
  }

  private async saveState() {
    await this.state.storage.put({
      created: this.created,
      roomCode: this.roomCode,
      maxPlayers: this.maxPlayers,
      hostId: this.hostId,
      joinOrder: this.joinOrder,
      phase: this.phase,
      chatHistory: this.chatHistory,
      readyIds: this.readyIds,
      disconnectedPlayers: Array.from(this.disconnectedPlayers.entries()),
      lastActivityAt: this.lastActivityAt,
      // 玩法字段
      civilianWord: this.civilianWord,
      undercoverWord: this.undercoverWord,
      undercoverId: this.undercoverId,
      eliminatedIds: this.eliminatedIds,
      round: this.round,
      descriptions: this.descriptions,
      votes: this.votes,
      voteRound: this.voteRound,
      tiebreakCandidates: this.tiebreakCandidates,
      phaseDeadline: this.phaseDeadline,
      lastRevealEliminatedId: this.lastRevealEliminatedId,
    });
  }

  /** Rolling-window rate check. Returns false when over limit. */
  private checkRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const info = this.wsMessageCounts.get(ws);
    if (!info || now - info.windowStart >= RATE_LIMIT_WINDOW_MS) {
      this.wsMessageCounts.set(ws, { windowStart: now, count: 1 });
      return true;
    }
    info.count++;
    return info.count <= RATE_LIMIT_MAX_MSGS;
  }

  /** Update last activity timestamp and schedule inactivity alarm */
  private async touchActivity() {
    const now = Date.now();
    this.lastActivityAt = now;

    // 节流：内存值每次都更新，但 storage.put + setAlarm 是高代价操作，限频。
    // inactivity 阈值是 10 分钟，±30s 误差完全可忽略。
    if (now - this.lastActivityPersistedAt < ACTIVITY_PERSIST_MIN_INTERVAL_MS) {
      return;
    }
    this.lastActivityPersistedAt = now;
    await this.state.storage.put("lastActivityAt", this.lastActivityAt);
    this.scheduleNextAlarm();
  }

  /** Schedule the earliest needed alarm (reconnect grace / inactivity / phase deadline) */
  private scheduleNextAlarm() {
    const candidates: number[] = [];

    // Reconnect grace deadlines
    for (const dp of this.disconnectedPlayers.values()) {
      candidates.push(dp.disconnectedAt + dp.graceMs);
    }

    // Inactivity timeout
    if (this.lastActivityAt > 0 && this.getEffectivePlayerCount() > 0) {
      candidates.push(this.lastActivityAt + INACTIVITY_TIMEOUT_MS);
    }

    // Phase deadline (describing/voting/reveal) —— 与 draw-guess 的关键差异
    if (this.phaseDeadline > 0) {
      candidates.push(this.phaseDeadline);
    }

    if (candidates.length > 0) {
      this.state.storage.setAlarm(Math.min(...candidates));
    }
  }

  /** Total player count including those in reconnection grace period */
  private getEffectivePlayerCount(): number {
    return this.getJoinedCount() + this.disconnectedPlayers.size;
  }

  // ============ Player helpers using WebSocket attachments ============

  private getPlayer(ws: WebSocket): PlayerAttachment | null {
    return ws.deserializeAttachment() as PlayerAttachment | null;
  }

  private getJoinedWebSockets(): { ws: WebSocket; player: PlayerAttachment }[] {
    const result: { ws: WebSocket; player: PlayerAttachment }[] = [];
    for (const ws of this.state.getWebSockets()) {
      const player = this.getPlayer(ws);
      if (player) {
        result.push({ ws, player });
      }
    }
    return result;
  }

  private getJoinedCount(): number {
    return this.getJoinedWebSockets().length;
  }

  // "active" = 仍在房间内（含重连宽限期 disconnectedPlayers），非单纯连接状态
  private isPlayerActive(id: string): boolean {
    if (this.disconnectedPlayers.has(id)) {
      return true;
    }
    return this.getJoinedWebSockets().some(({ player }) => player.id === id);
  }

  private getPlayerInfoList(): PlayerInfoWire[] {
    const joined = new Map(this.getJoinedWebSockets().map(({ player }) => [player.id, player]));
    const result: PlayerInfoWire[] = [];
    for (const id of this.joinOrder) {
      // 名字来源：先查已连接 ws，再回退到 grace 期断线玩家；都没有才跳过。
      // 这样重连宽限期内的玩家（isPlayerActive 含之）仍留在 roster，
      // 避免「当前发言者不在玩家列表」的 UI 不一致。
      const p = joined.get(id);
      const name = p?.name ?? this.disconnectedPlayers.get(id)?.name;
      if (name !== undefined) {
        result.push({
          id,
          name,
          isHost: id === this.hostId,
          alive: this.isPlayerActive(id) && !this.eliminatedIds.includes(id),
          ready: this.readyIds.includes(id),
        });
      }
    }
    return result;
  }

  // ============ HTTP fetch handler ============

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    // Internal: POST /init - mark room as created
    // Returns 409 if already created, so the parent Worker can retry with a new code.
    if (url.pathname === "/init" && request.method === "POST") {
      if (this.created) {
        return new Response(JSON.stringify({ error: "already created" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      const code = url.searchParams.get("code") || "";
      const maxRaw = parseInt(url.searchParams.get("max") || String(MIN_PLAYERS), 10);
      const maxPlayers =
        Number.isFinite(maxRaw) && maxRaw >= MIN_PLAYERS && maxRaw <= MAX_PLAYERS
          ? maxRaw
          : MIN_PLAYERS;
      this.created = true;
      this.roomCode = code;
      this.maxPlayers = maxPlayers;
      await this.state.storage.put({
        created: true,
        roomCode: code,
        maxPlayers,
      });
      return new Response("OK");
    }

    // POST /quickleave — beacon from pagehide, shorten grace period
    if (url.pathname.endsWith("/quickleave") && request.method === "POST") {
      const playerId = url.searchParams.get("playerId");
      if (!playerId) {
        return new Response("Missing playerId", { status: 400 });
      }

      // Case 1: Player still connected (beacon arrived before WS close) — mark for short grace
      for (const { ws, player } of this.getJoinedWebSockets()) {
        if (player.id === playerId) {
          ws.serializeAttachment({ ...player, quickLeave: true });
          return new Response("OK");
        }
      }

      // Case 2: Already disconnected (WS closed before beacon) — shorten grace
      const dp = this.disconnectedPlayers.get(playerId);
      if (dp) {
        dp.disconnectedAt = Date.now();
        dp.graceMs = QUICK_LEAVE_GRACE_MS;
        await this.saveState();
        this.scheduleNextAlarm();
      }

      return new Response("OK");
    }

    // Room info endpoint (non-WebSocket)
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response(
        JSON.stringify({
          playerCount: this.getEffectivePlayerCount(),
          closed: this.getEffectivePlayerCount() >= this.maxPlayers, // 满员才视为已关闭
          phase: this.phase,
          created: this.created,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // WebSocket upgrade — always accept; capacity is validated in onJoin
    // which can send a proper error message the client can display.
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket for hibernation; attachment will be set on "join"
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ============ Hibernatable WebSocket API handlers ============

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") {
      return;
    }
    await this.ensureLoaded();

    if (!this.checkRateLimit(ws)) {
      this.send(ws, { type: "error", message: "消息频率过高，连接已断开" });
      try {
        ws.close(1008, "rate limited");
      } catch {
        /* ignore */
      }
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    // Update activity on any player message (except join and ping heartbeat).
    // Ping would otherwise reset the inactivity timer and defeat auto-close.
    if (msg.type !== "join" && msg.type !== "ping") {
      await this.touchActivity();
    }

    switch (msg.type) {
      case "join":
        await this.onJoin(
          ws,
          msg.playerName as string,
          msg.playerId as string | undefined,
          typeof msg.v === "number" ? msg.v : undefined,
        );
        break;
      case "ping":
        this.send(ws, { type: "pong" });
        break;
      case "chat":
        await this.onChat(ws, msg.text as string);
        break;
      case "leave":
        await this.onLeave(ws);
        break;
      case "startGame":
        await this.onStartGame(ws);
        break;
      case "describe":
        await this.onDescribe(ws, msg.text as string);
        break;
      case "vote":
        await this.onVote(ws, msg.targetId as string);
        break;
      case "nextGame":
        await this.onNextGame(ws);
        break;
      case "ready":
        await this.onReady(ws, msg.ready === true);
        break;
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.ensureLoaded();
    await this.onDisconnect(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.ensureLoaded();
    await this.onDisconnect(ws);
  }

  async alarm() {
    await this.ensureLoaded();

    const now = Date.now();

    // --- 1. Process expired disconnected players ---
    const expired: DisconnectedPlayer[] = [];
    for (const [id, dp] of this.disconnectedPlayers) {
      if (now - dp.disconnectedAt >= dp.graceMs) {
        expired.push(dp);
        this.disconnectedPlayers.delete(id);
      }
    }
    for (const dp of expired) {
      await this.processActualLeave(dp);
    }

    // --- 2. Check inactivity timeout ---
    if (
      this.lastActivityAt > 0 &&
      now - this.lastActivityAt >= INACTIVITY_TIMEOUT_MS &&
      this.getEffectivePlayerCount() > 0
    ) {
      // Notify all connected players and destroy the room
      this.broadcast({
        type: "roomClosed",
        reason: "房间超过10分钟无活动，已自动关闭",
      });

      // Close all WebSockets
      for (const { ws } of this.getJoinedWebSockets()) {
        ws.serializeAttachment(null);
        try {
          ws.close(1000, "inactivity");
        } catch {
          /* ignore */
        }
      }

      // Reset room (含所有玩法字段)
      this.resetRoom();
      await this.saveState();
      return;
    }

    // --- 3. Phase deadline (describing/voting/reveal) ---
    if (this.phaseDeadline > 0 && now >= this.phaseDeadline) {
      if (this.phase === "describing") {
        // 同时作答窗口到点：未提交者不补条目（UI 显示「未描述」），直接进投票
        this.enterVoting();
        await this.saveState();
      } else if (this.phase === "voting") {
        // 投票超时：按已投的票计票（弃票忽略）
        await this.tallyAndResolve();
      } else if (this.phase === "reveal") {
        // 公布停留到点：判胜负 → 结束 或 下一轮
        await this.advanceAfterReveal();
      }
    }

    // --- 4. Schedule next alarm if needed ---
    this.scheduleNextAlarm();
  }

  // ============ Message Handlers ============

  /** 下发完整房间状态给指定连接（游戏中带本人的词）。 */
  private buildRoomState(ws: WebSocket, playerId: string) {
    const inGame = this.phase !== "lobby" && this.phase !== "ended";
    const yourWord = inGame
      ? playerId === this.undercoverId
        ? this.undercoverWord
        : this.civilianWord
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
      deadline: this.phaseDeadline || undefined,
      descriptions: this.descriptions,
      votedPlayerIds: Object.keys(this.votes),
      tiebreakCandidates: this.tiebreakCandidates.length ? this.tiebreakCandidates : undefined,
      ...(yourWord ? { yourWord } : {}),
      chatHistory: this.chatHistory,
    });
  }

  private async onJoin(
    ws: WebSocket,
    playerName: string,
    playerId?: string,
    clientVersion?: number,
  ) {
    // Protocol version check.
    if (clientVersion != null && clientVersion !== PROTOCOL_VERSION) {
      this.send(ws, { type: "error", message: "客户端版本过旧，请刷新页面" });
      try {
        ws.close(1000, "version mismatch");
      } catch {
        /* ignore */
      }
      return;
    }

    // Reject joins to non-existent rooms
    if (!this.created) {
      this.send(ws, { type: "error", message: "房间不存在" });
      try {
        ws.close(1000, "room not found");
      } catch {
        /* ignore */
      }
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
      // 旧 ws 尚未 close 的 take-over（竞态）
      for (const { ws: oldWs, player: ex } of this.getJoinedWebSockets()) {
        if (ex.id === playerId && oldWs !== ws) {
          oldWs.serializeAttachment(null);
          try {
            oldWs.close(1000, "reconnected");
          } catch {
            /* already closed */
          }
          const p: PlayerAttachment = { id: ex.id, name: ex.name };
          ws.serializeAttachment(p);
          await this.saveState();
          this.buildRoomState(ws, p.id);
          return;
        }
      }

      // 仍在花名册但既不在宽限期、也无存活旧连接 → 视为合法重连。
      // 典型成因：DO 被回收 / 抖动，webSocketClose 未及运行（玩家从未进入
      // disconnectedPlayers），但其 id 仍由 startGame 持久化在 joinOrder 中。
      // 不恢复就会被下方「新玩家」闸门当成中途加入而拒绝，客户端随即陷入
      // 「重连 → 被拒 → 再重连」死循环（疯狂弹「游戏已开始，无法加入」）。
      if (this.joinOrder.includes(playerId)) {
        const name = (playerName || "玩家").slice(0, MAX_NAME_LENGTH);
        const p: PlayerAttachment = { id: playerId, name };
        ws.serializeAttachment(p);
        this.buildRoomState(ws, p.id);
        return;
      }
    }

    // 新玩家：只能在 lobby 加入
    if (this.phase !== "lobby") {
      this.send(ws, { type: "error", message: "游戏已开始，无法加入" });
      try {
        ws.close(1000, "game in progress");
      } catch {
        /* ignore */
      }
      return;
    }
    if (this.getEffectivePlayerCount() >= this.maxPlayers) {
      this.send(ws, { type: "error", message: "房间已满" });
      try {
        ws.close(1000, "room full");
      } catch {
        /* ignore */
      }
      return;
    }

    const isFirst = this.joinOrder.length === 0;
    const player: PlayerAttachment = {
      id: crypto.randomUUID(),
      name: (playerName || `玩家${this.joinOrder.length + 1}`).slice(0, MAX_NAME_LENGTH),
    };
    ws.serializeAttachment(player);
    this.joinOrder.push(player.id);
    if (isFirst) {
      this.hostId = player.id;
    }
    await this.saveState();

    // Send full state to the joining player
    this.buildRoomState(ws, player.id);

    // Notify other players about the new join
    this.broadcast(
      {
        type: "playerJoined",
        player: {
          id: player.id,
          name: player.name,
          isHost: player.id === this.hostId,
          alive: true,
          ready: false,
        },
      },
      ws,
    );
  }

  private async onChat(ws: WebSocket, text: string) {
    const player = this.getPlayer(ws);
    if (!player) {
      return;
    }
    if (!text || text.trim().length === 0) {
      return;
    }

    const timestamp = Date.now();
    const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);

    this.chatHistory.push({
      playerId: player.id,
      playerName: player.name,
      text: trimmed,
      timestamp,
    });
    if (this.chatHistory.length > MAX_CHAT_HISTORY) {
      this.chatHistory = this.chatHistory.slice(-MAX_CHAT_HISTORY);
    }
    await this.state.storage.put("chatHistory", this.chatHistory);

    this.broadcast({
      type: "chat",
      playerId: player.id,
      playerName: player.name,
      text: trimmed,
      timestamp,
    });
  }

  // ============ Gameplay: startGame / describe ============

  /** 当前在场且未出局的玩家 id（按 joinOrder）。 */
  private aliveIds(): string[] {
    return this.joinOrder.filter(
      (id) => this.isPlayerActive(id) && !this.eliminatedIds.includes(id),
    );
  }

  /** 大厅准备 / 取消准备：仅大厅、非房主可切换；幂等；广播 readyUpdate。 */
  private async onReady(ws: WebSocket, ready: boolean) {
    const player = this.getPlayer(ws);
    if (!player) {
      return;
    }
    if (this.phase !== "lobby" || player.id === this.hostId) {
      return;
    }
    const isReady = this.readyIds.includes(player.id);
    if (ready === isReady) {
      return;
    }
    if (ready) {
      this.readyIds.push(player.id);
    } else {
      this.readyIds = this.readyIds.filter((id) => id !== player.id);
    }
    await this.saveState();
    this.broadcast({ type: "readyUpdate", playerId: player.id, ready });
  }

  /** host 开局：发词、分配卧底、进入首轮描述，逐 ws 个性化下发各自的词。 */
  private async onStartGame(ws: WebSocket) {
    const player = this.getPlayer(ws);
    if (!player || player.id !== this.hostId) {
      return;
    }
    if (this.phase !== "lobby") {
      return;
    }
    if (this.getJoinedCount() < MIN_PLAYERS) {
      this.send(ws, { type: "error", message: `至少需要 ${MIN_PLAYERS} 人才能开始` });
      return;
    }
    // 非房主玩家必须全部已准备
    const nonHostIds = this.getJoinedWebSockets()
      .map(({ player: p }) => p.id)
      .filter((id) => id !== this.hostId);
    if (!nonHostIds.every((id) => this.readyIds.includes(id))) {
      this.send(ws, { type: "error", message: "还有玩家未准备" });
      return;
    }

    // 发词（DeepSeek → 兜底）
    const { pair, bankIndex } = await getWordPair(this.env, this.recentWordIndices);
    if (bankIndex >= 0) {
      this.recentWordIndices.push(bankIndex);
      if (this.recentWordIndices.length > 10) {
        this.recentWordIndices.shift();
      }
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
    this.readyIds = []; // 开局清空，下局回大厅需重新准备

    this.startDescribingRound();

    // 逐 ws 个性化下发各自的词
    for (const { ws: w, player: p } of this.getJoinedWebSockets()) {
      this.send(w, {
        type: "gameStarted",
        yourWord: p.id === this.undercoverId ? this.undercoverWord : this.civilianWord,
        round: this.round,
        deadline: this.phaseDeadline,
      });
    }
    await this.saveState();
  }

  /** 开一轮描述（同时作答）：清空本轮描述，设 phase/deadline/alarm；无发言序。 */
  private startDescribingRound() {
    this.descriptions = [];
    this.phase = "describing";
    this.phaseDeadline = Date.now() + DESCRIBE_MS;
    this.scheduleNextAlarm();
  }

  /** 同时作答：任意存活者本轮提交一次（提交即广播、提交后锁定）。
   *  非描述阶段 / 出局者 / 本轮已提交过 / 空内容均忽略；全员提交则立即进投票。 */
  private async onDescribe(ws: WebSocket, text: string) {
    const player = this.getPlayer(ws);
    if (!player || this.phase !== "describing") {
      return;
    }
    const alive = this.aliveIds();
    if (!alive.includes(player.id)) {
      return; // 出局者不能作答
    }
    if (this.descriptions.some((d) => d.playerId === player.id)) {
      return; // 本轮已提交，锁定
    }
    const trimmed = (text || "").trim().slice(0, MAX_DESCRIBE_LENGTH);
    if (!trimmed) {
      return;
    }
    this.recordDescription(player.id, trimmed);
    // 全部存活者都提交完 → 立即进投票；否则落盘
    if (alive.every((id) => this.descriptions.some((d) => d.playerId === id))) {
      this.enterVoting();
    }
    await this.saveState();
  }

  /** 记录一条描述并实时广播（同时作答无发言序，不推进）。 */
  private recordDescription(playerId: string, text: string) {
    this.descriptions.push({ playerId, text, round: this.round });
    this.broadcast({ type: "describeUpdate", playerId, text, round: this.round });
  }

  /** 进入投票阶段。 */
  private enterVoting() {
    this.phase = "voting";
    this.votes = {};
    this.voteRound = 1;
    this.tiebreakCandidates = [];
    this.phaseDeadline = Date.now() + VOTE_MS;
    this.scheduleNextAlarm();
    this.broadcast({
      type: "phaseChange",
      phase: "voting",
      round: this.round,
      deadline: this.phaseDeadline,
    });
  }

  // ============ Gameplay: vote / tally / reveal / endGame ============

  /** 投票。仅 voting 阶段；投票者/目标须存活；不能投自己；加赛仅限候选人。 */
  private async onVote(ws: WebSocket, targetId: string) {
    const player = this.getPlayer(ws);
    if (!player || this.phase !== "voting") {
      return;
    }
    const alive = this.aliveIds();
    if (!alive.includes(player.id)) {
      return; // 出局者不能投
    }
    if (player.id === targetId) {
      return; // 不能投自己
    }
    if (!alive.includes(targetId)) {
      return; // 目标须存活
    }
    if (this.voteRound === 2 && !this.tiebreakCandidates.includes(targetId)) {
      return; // 加赛仅候选人
    }
    this.votes[player.id] = targetId;
    // 仅广播「谁投了」，绝不暴露票向
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
        type: "voteResult",
        tally: counts,
        eliminatedId: null,
        tiebreak: { candidates: topIds, round: 2 },
      });
      this.broadcast({
        type: "phaseChange",
        phase: "voting",
        round: this.round,
        deadline: this.phaseDeadline,
        tiebreakCandidates: topIds,
      });
      return;
    }
    // 平票且已加赛，或无人投票 → 无人淘汰，直接进 reveal
    await this.enterReveal(null, null, counts);
  }

  /** 投票出局：标记出局 + 进 reveal（带身份）。 */
  private async eliminateByVote(targetId: string, counts: Record<string, number>) {
    this.eliminatedIds.push(targetId);
    const role: Role = targetId === this.undercoverId ? "undercover" : "civilian";
    await this.enterReveal(targetId, role, counts);
  }

  /** 进入公布阶段：记账本轮出局者，广播 voteResult，设 REVEAL_MS alarm。 */
  private async enterReveal(
    eliminatedId: string | null,
    role: Role | null,
    counts: Record<string, number>,
  ) {
    this.phase = "reveal";
    this.lastRevealEliminatedId = eliminatedId;
    this.phaseDeadline = Date.now() + REVEAL_MS;
    this.scheduleNextAlarm();
    await this.saveState();
    this.broadcast({
      type: "voteResult",
      tally: counts,
      eliminatedId,
      ...(role ? { eliminatedRole: role } : {}),
    });
    this.broadcast({
      type: "phaseChange",
      phase: "reveal",
      round: this.round,
      deadline: this.phaseDeadline,
    });
  }

  /** reveal 到点：判胜负 → 结束 或 下一轮描述。 */
  private async advanceAfterReveal() {
    const eid = this.lastRevealEliminatedId;
    const role: Role | null = eid
      ? eid === this.undercoverId
        ? "undercover"
        : "civilian"
      : null;
    const winner = checkWin(role, this.aliveIds().length);
    if (winner) {
      await this.endGame(winner);
    } else {
      this.round++;
      this.descriptions = [];
      // 清空上轮投票状态：否则下一轮描述期间残留旧投票，重连玩家会收到脏 votedPlayerIds
      this.votes = {};
      this.voteRound = 1;
      this.tiebreakCandidates = [];
      this.startDescribingRound();
      await this.saveState();
      this.broadcast({
        type: "phaseChange",
        phase: "describing",
        round: this.round,
        deadline: this.phaseDeadline,
      });
    }
  }

  /** 结束游戏：揭晓所有身份 + 词。 */
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
      // endGame 仅在游戏中触发，这三者必非 null（S_GameOver 要求 string）
      undercoverId: this.undercoverId!,
      civilianWord: this.civilianWord!,
      undercoverWord: this.undercoverWord!,
      roles,
    });
  }

  /** host 再来一局：回到大厅，清空所有玩法字段（保留玩家与聊天）。 */
  private async onNextGame(ws: WebSocket) {
    const player = this.getPlayer(ws);
    if (!player || player.id !== this.hostId) {
      return;
    }
    if (this.phase !== "ended") {
      return;
    }
    this.phase = "lobby";
    this.resetGameplayFields();
    // 注意：不重置 recentWordIndices —— 再来一局仍保留跨局发词去重
    await this.saveState();
    this.broadcast({ type: "phaseChange", phase: "lobby", round: 0 });
  }

  /** Intentional leave — immediate removal, no grace period */
  private async onLeave(ws: WebSocket) {
    const player = this.getPlayer(ws);
    if (!player) {
      return;
    }

    ws.serializeAttachment(null);

    // Process as actual leave immediately
    await this.processActualLeave({
      id: player.id,
      name: player.name,
      disconnectedAt: 0,
      graceMs: 0,
    });

    try {
      ws.close(1000, "left");
    } catch {
      /* ignore */
    }
  }

  /** Unintentional disconnect — grace period for reconnection */
  private async onDisconnect(ws: WebSocket) {
    const player = this.getPlayer(ws);
    if (!player) {
      return;
    }

    // Clear attachment so this ws is no longer counted as a joined player
    ws.serializeAttachment(null);

    // Use short grace if quickleave beacon was received (page unload — refresh/close/navigate)
    const graceMs = player.quickLeave ? QUICK_LEAVE_GRACE_MS : RECONNECT_GRACE_MS;

    // Store in disconnectedPlayers for reconnection grace period
    this.disconnectedPlayers.set(player.id, {
      id: player.id,
      name: player.name,
      disconnectedAt: Date.now(),
      graceMs,
    });

    await this.saveState();

    // Schedule alarm to clean up if they don't reconnect
    this.scheduleNextAlarm();
  }

  /** Called when a disconnected player's grace period expires without reconnecting */
  private async processActualLeave(dp: DisconnectedPlayer) {
    // wasAlive：移除前是否仍是「在场未出局」的参与者。
    // 此刻该 ws 已无 attachment、且已从 disconnectedPlayers 移除，isPlayerActive 必为 false，
    // 故不能用 aliveIds()（会恒为 false）；直接按 joinOrder 成员且未出局判定。
    const wasAlive = this.joinOrder.includes(dp.id) && !this.eliminatedIds.includes(dp.id);
    const wasHost = dp.id === this.hostId;

    // 从在场序列与出局列表移除；并从投票中删除该人作为投票者或被投目标的条目
    this.joinOrder = this.joinOrder.filter((id) => id !== dp.id);
    this.eliminatedIds = this.eliminatedIds.filter((id) => id !== dp.id);
    this.descriptions = this.descriptions.filter((d) => d.playerId !== dp.id);
    this.readyIds = this.readyIds.filter((id) => id !== dp.id);
    this.votes = Object.fromEntries(
      Object.entries(this.votes).filter(([voter, target]) => voter !== dp.id && target !== dp.id),
    );

    const remaining = this.getJoinedWebSockets();
    // Also consider other disconnected players still in grace period
    const otherDisconnected = Array.from(this.disconnectedPlayers.values());
    const allRemaining = [...remaining.map((r) => r.player), ...otherDisconnected];

    if (allRemaining.length === 0) {
      // Room is truly empty, reset everything (含所有玩法字段)
      this.resetRoom();
      await this.saveState();
      return;
    }

    // host 迁移：离开者是 host 则交给最早仍在场者。
    // 优先连接中的玩家，再退化到在房间内的（grace 期断线），最后兜底 allRemaining[0]。
    if (wasHost) {
      const connectedIds = new Set(this.getJoinedWebSockets().map(({ player }) => player.id));
      const newHost =
        this.joinOrder.find((id) => connectedIds.has(id)) ??
        this.joinOrder.find((id) => this.isPlayerActive(id)) ??
        allRemaining[0].id;
      this.hostId = newHost;
      this.readyIds = this.readyIds.filter((id) => id !== newHost); // 新房主不参与准备
      // 通知所有端房主已变更。游戏中不重发完整 roomState（会清空客户端的 voteResult
      // 等瞬时态），只发轻量 hostChanged 让前端更新 hostId（皇冠 + 结算「再来一局」权限）。
      this.broadcast({ type: "hostChanged", hostId: newHost });
    }

    const inGame =
      this.phase === "describing" || this.phase === "voting" || this.phase === "reveal";
    if (inGame && wasAlive) {
      // 游戏中在场玩家离开：按出局处理，公开身份 + 重算胜负
      const role: Role = dp.id === this.undercoverId ? "undercover" : "civilian";
      this.broadcast({ type: "playerLeft", playerId: dp.id, revealedRole: role });
      const winner = checkWin(role, this.aliveIds().length);
      if (winner) {
        await this.endGame(winner);
        return;
      }
      // 游戏继续：修复当前阶段（描述/投票的计票时机）
      await this.fixupPhaseAfterRemoval();
    } else {
      // 大厅，或离开的是已出局观战者：仅通知 + 持久化
      this.broadcast({ type: "playerLeft", playerId: dp.id });
      // host 在大厅迁移：补发完整 roomState，让各端更新房主与准备态
      if (wasHost && this.phase === "lobby") {
        for (const { ws: w, player: p } of this.getJoinedWebSockets()) {
          this.buildRoomState(w, p.id);
        }
      }
      await this.saveState();
    }
  }

  /** 离开者影响当前阶段时的修复：描述/投票阶段都检查「剩余存活者是否已全部行动」可推进。 */
  private async fixupPhaseAfterRemoval() {
    if (this.phase === "describing") {
      // 同时作答：离开者已从 aliveIds 移除。剩余存活者都已提交 → 进投票，否则继续等待。
      // enterVoting 自身只 setAlarm/broadcast 不落盘，故下方统一 saveState。
      const alive = this.aliveIds();
      if (alive.length > 0 && alive.every((id) => this.descriptions.some((d) => d.playerId === id))) {
        this.enterVoting();
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
      // reveal（及其他）是纯展示阶段，无发言序需修复；
      // alarm 到点会调 advanceAfterReveal 推进，这里仅落盘玩家移除即可
      await this.saveState();
    }
  }

  /** 重置房间到初始（空房 / inactivity 关闭）。清空 base + 所有玩法字段。 */
  private resetRoom() {
    this.created = false;
    this.roomCode = "";
    this.maxPlayers = MIN_PLAYERS;
    this.hostId = null;
    this.joinOrder = [];
    this.phase = "lobby";
    this.chatHistory = [];
    this.disconnectedPlayers.clear();
    // 与 inactivity 路径对齐：清空 idle 计时基准。否则下次 /init 复用此 DO
    // 时，scheduleNextAlarm 可能基于旧值算出已过期的 inactivity 时间点。
    this.lastActivityAt = 0;
    // 玩法字段
    this.resetGameplayFields();
    // 空房 / inactivity 关闭额外清空跨局去重（onNextGame 则保留）
    this.recentWordIndices = [];
  }

  /** 重置所有玩法字段到开局前（不含 base 字段，也不含 recentWordIndices）。 */
  private resetGameplayFields() {
    this.civilianWord = null;
    this.undercoverWord = null;
    this.undercoverId = null;
    this.eliminatedIds = [];
    this.round = 0;
    this.descriptions = [];
    this.votes = {};
    this.voteRound = 1;
    this.tiebreakCandidates = [];
    this.phaseDeadline = 0;
    this.lastRevealEliminatedId = null;
    this.readyIds = []; // 回大厅需重新准备
  }

  // ============ Helpers ============

  private send(ws: WebSocket, msg: Record<string, unknown>) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // WebSocket may already be closed
    }
  }

  private broadcast(msg: Record<string, unknown>, exclude?: WebSocket) {
    for (const ws of this.state.getWebSockets()) {
      if (ws !== exclude) {
        const player = this.getPlayer(ws);
        if (player) {
          this.send(ws, msg);
        }
      }
    }
  }
}
