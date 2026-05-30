import { useState, useRef, useEffect } from "react";
import { tx } from "@twind/core";
import type { ChatEntry, PlayerInfo } from "../types/protocol";

// 与服务端 constants.MAX_CHAT_LENGTH 保持一致
const MAX_CHAT_LENGTH = 200;

interface Props {
  messages: ChatEntry[];
  players: PlayerInfo[];
  myId: string | null;
  onSend: (text: string) => void;
}

/** 右侧聊天面板：仅展示聊天消息（描述不进此处，描述显示在各玩家头像下方）。 */
export default function ChatPanel({ messages, players, myId, onSend }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // 仅在新消息到来时滚到底部（不打断用户上滑查看历史）
  useEffect(() => {
    if (messages.length > prevLengthRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

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

      {/* 消息列表 */}
      <div ref={listRef} className={tx("flex-1 overflow-y-auto p-3 space-y-2 min-h-0")}>
        {messages.length === 0 && (
          <div className={tx("text-caption text-ink-tertiary text-center py-2")}>暂无消息</div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.playerId === myId;
          const seat = seatOf(msg.playerId);
          const label = seat !== null ? `${seat}号 ${msg.playerName}` : msg.playerName;

          if (isMe) {
            return (
              <div key={`${msg.playerId}-${msg.timestamp}-${idx}`} className={tx("flex justify-end")}>
                <div
                  className={tx(
                    "max-w-[80%] bg-primary text-on-primary rounded-lg px-3 py-1.5 text-caption break-words",
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={`${msg.playerId}-${msg.timestamp}-${idx}`} className={tx("flex gap-2 items-start")}>
              <span
                className={tx(
                  "w-7 h-7 rounded-full bg-surface-3 border border-hairline-strong shrink-0",
                  "flex items-center justify-center text-caption text-ink-subtle",
                )}
              >
                {msg.playerName.slice(0, 1).toUpperCase()}
              </span>
              <div className={tx("flex flex-col gap-0.5 min-w-0")}>
                <span className={tx("text-caption text-ink-tertiary")}>{label}</span>
                <div className={tx("rounded-lg px-3 py-1.5 text-caption break-words bg-surface-3 text-ink-muted")}>
                  {msg.text}
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
