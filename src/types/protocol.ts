// 前后端共享消息契约。worker 端 types/room 手动镜像字段（不跨包 import）。
// 与 worker/src/constants.ts 的 PROTOCOL_VERSION 双写一致。
export const PROTOCOL_VERSION = 2;

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
  deadline?: number;          // 当前阶段倒计时绝对时间戳（describing 窗口/voting）
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
  deadline: number;
}
export interface S_PhaseChange {
  type: "phaseChange";
  phase: GamePhase;
  round?: number;
  deadline?: number;
  tiebreakCandidates?: string[];
}
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
  | S_DescribeUpdate | S_VoteUpdate | S_VoteResult | S_GameOver
  | S_Chat | S_Error | S_RoomClosed | S_Pong;
