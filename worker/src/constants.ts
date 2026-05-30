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
export const DESCRIBE_MS = 45_000; // 整轮同时作答窗口
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
export const PROTOCOL_VERSION = 2;
