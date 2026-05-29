import { useState } from "react";
import { tx } from "@twind/core";
import type { DescribeEntry, PlayerInfo } from "../types/protocol";

interface Props {
  descriptions: DescribeEntry[];
  round: number;
  players: PlayerInfo[];
  isMyTurn: boolean;
  currentSpeakerName?: string;
  onSubmit: (text: string) => void;
}

/**
 * 描述阶段面板：
 * - 展示本轮已发言记录（按 round 过滤）
 * - 轮到自己时显示输入框 + 提交按钮（空文本禁用）
 * - 非自己回合显示等待提示
 */
export default function DescribePanel({
  descriptions,
  round,
  players,
  isMyTurn,
  currentSpeakerName,
  onSubmit,
}: Props) {
  const [inputText, setInputText] = useState("");

  const currentRoundDescriptions = descriptions.filter((d) => d.round === round);

  const getPlayerName = (playerId: string): string => {
    return players.find((p) => p.id === playerId)?.name ?? "未知玩家";
  };

  const handleSubmit = () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      return;
    }
    onSubmit(trimmed);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div
      className={tx(
        "bg-surface-1 border border-hairline rounded-xl p-6 flex flex-col gap-4",
      )}
    >
      <h3 className={tx("text-subhead font-display font-semibold text-ink")}>
        本轮描述
      </h3>

      {/* 已发言记录 */}
      {currentRoundDescriptions.length > 0 ? (
        <ul className={tx("flex flex-col gap-2")}>
          {currentRoundDescriptions.map((entry, idx) => (
            <li
              key={idx}
              className={tx(
                "px-3 py-2 rounded-lg bg-surface-2 border border-hairline",
                "text-body-sm text-ink",
              )}
            >
              <span className={tx("text-ink-muted font-medium")}>
                {getPlayerName(entry.playerId)}：
              </span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={tx("text-body-sm text-ink-subtle italic")}>
          本轮暂无描述记录
        </p>
      )}

      {/* 输入区 */}
      {isMyTurn ? (
        <div className={tx("flex flex-col gap-2 pt-2 border-t border-hairline")}>
          <p className={tx("text-body-sm text-primary font-medium")}>轮到你了，请描述你的词</p>
          <div className={tx("flex gap-2")}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={50}
              placeholder="用一句话描述（最多 50 字）..."
              className={tx(
                "flex-1 px-3 py-2 rounded-lg text-body-sm",
                "bg-surface-2 border border-hairline text-ink",
                "placeholder:text-ink-tertiary",
                "focus:outline-none focus:border-primary",
                "transition-colors",
              )}
            />
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim()}
              className={tx(
                "px-4 py-2 rounded-lg text-button font-medium transition-colors shrink-0",
                inputText.trim()
                  ? "bg-primary text-on-primary hover:bg-primary-hover cursor-pointer"
                  : "bg-surface-3 text-ink-subtle border border-hairline cursor-not-allowed",
              )}
            >
              提交
            </button>
          </div>
          <p className={tx("text-caption text-ink-tertiary text-right")}>
            {inputText.length} / 50
          </p>
        </div>
      ) : (
        <div className={tx("pt-2 border-t border-hairline")}>
          <p className={tx("text-body-sm text-ink-subtle text-center")}>
            {currentSpeakerName
              ? `等待 ${currentSpeakerName} 描述...`
              : "等待其他玩家描述..."}
          </p>
        </div>
      )}
    </div>
  );
}
