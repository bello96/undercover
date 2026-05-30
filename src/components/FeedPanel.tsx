import { useState, useRef, useEffect } from "react";
import { tx } from "@twind/core";
import type { PlayerInfo } from "../types/protocol";

// 与服务端 constants.MAX_CHAT_LENGTH 保持一致
const MAX_CHAT_LENGTH = 200;

/** 右侧信息流条目：描述（发言）与聊天合并展示，按到达顺序累积。 */
export interface FeedItem {
  id: string;
  kind: "describe" | "chat";
  playerId: string;
  playerName: string;
  text: string;
  round?: number;
}

interface Props {
  items: FeedItem[];
  players: PlayerInfo[];
  myId: string | null;
  onSend: (text: string) => void;
}

/**
 * 右侧聊天 / 发言流（参考你画我猜：本轮描述像猜词一样汇入信息流）。
 * - 描述条目：左侧头像 + 「N号 名字」+ 主色描边气泡。
 * - 聊天条目：他人左侧气泡；本人右侧主色气泡。
 */
export default function FeedPanel({ items, players, myId, onSend }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(items.length);

  // 仅在新条目到来时滚到底部（不打断用户上滑查看历史）
  useEffect(() => {
    if (items.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevLengthRef.current = items.length;
  }, [items]);

  const seatOf = (playerId: string): number | null => {
    const idx = players.findIndex((p) => p.id === playerId);
    return idx >= 0 ? idx + 1 : null;
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    onSend(text);
    setInput("");
  };

  return (
    <div
      className={tx(
        "flex flex-col bg-surface-1 rounded-xl overflow-hidden border border-hairline h-full min-h-0",
      )}
    >
      {/* Header */}
      <div className={tx("px-4 py-3 border-b border-hairline shrink-0")}>
        <span className={tx("text-body-sm font-medium text-ink-muted")}>聊天</span>
      </div>

      {/* 信息流 */}
      <div ref={listRef} className={tx("flex-1 overflow-y-auto p-3 space-y-2 min-h-0")}>
        {items.length === 0 && (
          <div className={tx("text-caption text-ink-tertiary text-center py-2")}>暂无消息</div>
        )}
        {items.map((item) => {
          const isMe = item.playerId === myId;
          const seat = seatOf(item.playerId);
          const label = seat !== null ? `${seat}号 ${item.playerName}` : item.playerName;

          // 本人聊天 → 右侧主色气泡
          if (isMe && item.kind === "chat") {
            return (
              <div key={item.id} className={tx("flex justify-end")}>
                <div
                  className={tx(
                    "max-w-[80%] bg-primary text-on-primary rounded-lg px-3 py-1.5 text-caption break-words",
                  )}
                >
                  {item.text}
                </div>
              </div>
            );
          }

          // 其余（描述 / 他人聊天）→ 左侧头像 + 名 + 气泡
          return (
            <div key={item.id} className={tx("flex gap-2 items-start")}>
              <span
                className={tx(
                  "w-7 h-7 rounded-full bg-surface-3 border border-hairline-strong shrink-0",
                  "flex items-center justify-center text-caption text-ink-subtle",
                )}
              >
                {item.playerName.slice(0, 1).toUpperCase()}
              </span>
              <div className={tx("flex flex-col gap-0.5 min-w-0")}>
                <span className={tx("text-caption text-ink-tertiary")}>{label}</span>
                <div
                  className={tx(
                    "rounded-lg px-3 py-1.5 text-caption break-words",
                    item.kind === "describe"
                      ? "bg-surface-2 text-ink border-l-2 border-primary"
                      : "bg-surface-3 text-ink-muted",
                  )}
                >
                  {item.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 输入 */}
      <div className={tx("px-3 py-2.5 border-t border-hairline flex gap-2 items-center shrink-0")}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 排除输入法组合态，避免选字时按 Enter 误发
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              handleSubmit();
            }
          }}
          placeholder="说点什么..."
          maxLength={MAX_CHAT_LENGTH}
          className={tx(
            "flex-1 px-3 py-2 text-caption bg-surface-2 border border-hairline rounded-lg text-ink",
            "placeholder-ink-tertiary focus:outline-none focus:border-primary transition-colors",
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={tx(
            "px-4 py-2 text-caption rounded-lg transition shrink-0",
            input.trim()
              ? "bg-primary text-on-primary hover:bg-primary-hover"
              : "bg-surface-3 text-ink-tertiary cursor-not-allowed",
          )}
        >
          发送
        </button>
      </div>
    </div>
  );
}
