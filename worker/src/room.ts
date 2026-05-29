import {
  ACTIVITY_PERSIST_MIN_INTERVAL_MS,
  INACTIVITY_TIMEOUT_MS,
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROTOCOL_VERSION,
  QUICK_LEAVE_GRACE_MS,
  RATE_LIMIT_MAX_MSGS,
  RATE_LIMIT_WINDOW_MS,
  RECONNECT_GRACE_MS,
} from "./constants";
import type {
  ChatEntry,
  DescribeEntry,
  DisconnectedPlayer,
  Env,
  GamePhase,
  PlayerAttachment,
} from "./types";

interface PlayerInfoWire {
  id: string;
  name: string;
  isHost: boolean;
  alive: boolean;
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
  private speakingOrder: string[] = [];
  private currentSpeakerIndex = 0;
  private descriptions: DescribeEntry[] = []; // 累积
  private votes: Record<string, string> = {};
  private voteRound: 1 | 2 = 1;
  private tiebreakCandidates: string[] = [];
  private phaseDeadline = 0; // describing/voting/reveal 的 alarm 截止
  private recentWordIndices: number[] = []; // 内置库近期去重（内存即可，不持久化）
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
      "disconnectedPlayers",
      "lastActivityAt",
      // 玩法字段
      "civilianWord",
      "undercoverWord",
      "undercoverId",
      "eliminatedIds",
      "round",
      "speakingOrder",
      "currentSpeakerIndex",
      "descriptions",
      "votes",
      "voteRound",
      "tiebreakCandidates",
      "phaseDeadline",
    ]);

    this.created = (data.get("created") as boolean) ?? false;
    this.roomCode = (data.get("roomCode") as string) ?? "";
    this.maxPlayers = (data.get("maxPlayers") as number) ?? MIN_PLAYERS;
    this.hostId = (data.get("hostId") as string | null) ?? null;
    this.joinOrder = (data.get("joinOrder") as string[]) ?? [];
    this.phase = (data.get("phase") as GamePhase) ?? "lobby";
    this.chatHistory = (data.get("chatHistory") as ChatEntry[]) ?? [];

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
    this.speakingOrder = (data.get("speakingOrder") as string[]) ?? [];
    this.currentSpeakerIndex = (data.get("currentSpeakerIndex") as number) ?? 0;
    this.descriptions = (data.get("descriptions") as DescribeEntry[]) ?? [];
    this.votes = (data.get("votes") as Record<string, string>) ?? {};
    this.voteRound = (data.get("voteRound") as 1 | 2) ?? 1;
    this.tiebreakCandidates = (data.get("tiebreakCandidates") as string[]) ?? [];
    this.phaseDeadline = (data.get("phaseDeadline") as number) ?? 0;
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
      disconnectedPlayers: Array.from(this.disconnectedPlayers.entries()),
      lastActivityAt: this.lastActivityAt,
      // 玩法字段
      civilianWord: this.civilianWord,
      undercoverWord: this.undercoverWord,
      undercoverId: this.undercoverId,
      eliminatedIds: this.eliminatedIds,
      round: this.round,
      speakingOrder: this.speakingOrder,
      currentSpeakerIndex: this.currentSpeakerIndex,
      descriptions: this.descriptions,
      votes: this.votes,
      voteRound: this.voteRound,
      tiebreakCandidates: this.tiebreakCandidates,
      phaseDeadline: this.phaseDeadline,
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
      const player = joined.get(id);
      if (player) {
        result.push({
          id: player.id,
          name: player.name,
          isHost: player.id === this.hostId,
          alive: this.isPlayerActive(player.id) && !this.eliminatedIds.includes(player.id),
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
      // startGame/describe/vote/nextGame —— 后续单元追加
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
    // TODO(单元7/8): describing/voting/reveal 超时处理

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
    // 从在场序列与出局列表移除
    this.joinOrder = this.joinOrder.filter((id) => id !== dp.id);
    this.eliminatedIds = this.eliminatedIds.filter((id) => id !== dp.id);

    const remaining = this.getJoinedWebSockets();
    // Also consider other disconnected players still in grace period
    const otherDisconnected = Array.from(this.disconnectedPlayers.values());
    const allRemaining = [...remaining.map((r) => r.player), ...otherDisconnected];

    if (allRemaining.length > 0) {
      // Notify connected players about the leave
      this.broadcast({
        type: "playerLeft",
        playerId: dp.id,
      });

      // host 迁移：离开者是 host 则交给最早仍在场者
      if (dp.id === this.hostId) {
        let newHost: string | null = null;
        for (const id of this.joinOrder) {
          if (this.isPlayerActive(id)) {
            newHost = id;
            break;
          }
        }
        this.hostId = newHost ?? allRemaining[0].id;
      }

      // TODO(单元8): 游戏中离开按出局 + 重算胜负

      await this.saveState();
    } else {
      // Room is truly empty, reset everything (含所有玩法字段)
      this.resetRoom();
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
    this.civilianWord = null;
    this.undercoverWord = null;
    this.undercoverId = null;
    this.eliminatedIds = [];
    this.round = 0;
    this.speakingOrder = [];
    this.currentSpeakerIndex = 0;
    this.descriptions = [];
    this.votes = {};
    this.voteRound = 1;
    this.tiebreakCandidates = [];
    this.phaseDeadline = 0;
    this.recentWordIndices = [];
    this.lastRevealEliminatedId = null;
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
