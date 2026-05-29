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
