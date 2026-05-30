import { useState, useRef, useEffect } from "react";
import { tx } from "@twind/core";
import type { ChatEntry } from "../types/protocol";

interface Props {
  messages: ChatEntry[];
  myId: string | null;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, myId, onSend }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // 仅在新消息到来时滚到底部（不影响用户上滑查看历史）
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

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
        "flex flex-col bg-surface-1 rounded-lg overflow-hidden border border-hairline",
        "h-full min-h-0",
      )}
    >
      {/* Header */}
      <div className={tx("px-3 py-2 border-b border-hairline")}>
        <span className={tx("text-body-sm font-medium text-ink-muted")}>聊天</span>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className={tx("flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0")}
      >
        {messages.length === 0 && (
          <div className={tx("text-caption text-ink-tertiary text-center py-2")}>
            暂无消息
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.playerId === myId;
          return (
            <div
              key={`${msg.playerId}-${msg.timestamp}-${idx}`}
              className={tx("flex flex-col", isMe ? "items-end" : "items-start")}
            >
              <div
                className={tx(
                  "text-caption px-2 py-1 rounded-md max-w-[85%] break-words",
                  isMe
                    ? "bg-primary text-on-primary"
                    : "bg-surface-3 text-ink",
                )}
              >
                {!isMe && (
                  <span className={tx("font-medium text-ink-muted mr-1")}>
                    {msg.playerName}:
                  </span>
                )}
                <span>{msg.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className={tx("px-3 py-2 border-t border-hairline flex gap-2 items-center")}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 排除中文/日文等输入法组合态，避免选字时按 Enter 误发半成品
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              handleSubmit();
            }
          }}
          placeholder="发送消息..."
          maxLength={200}
          className={tx(
            "flex-1 px-2.5 py-1.5 text-caption bg-surface-2 border border-hairline rounded-md",
            "text-ink placeholder-ink-tertiary",
            "focus:outline-none focus:border-primary",
            "transition-colors",
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={tx(
            "px-3 py-1.5 text-caption text-on-primary rounded-md transition shrink-0",
            input.trim()
              ? "bg-primary hover:bg-primary-hover"
              : "bg-surface-3 text-ink-tertiary cursor-not-allowed",
          )}
        >
          发送
        </button>
      </div>
    </div>
  );
}
