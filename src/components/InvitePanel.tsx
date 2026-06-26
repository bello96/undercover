import { useState } from "react";
import { tx } from "@twind/core";

interface Props {
  roomCode: string;
  isFull: boolean;
}

/** 大厅左侧邀请面板：房间号（点击复制）+ 复制链接。 */
export default function InvitePanel({ roomCode, isFull }: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  return (
    <div className={tx("flex flex-col gap-3")}>
      <div className={tx("bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col gap-3")}>
        <span className={tx("text-body-sm font-medium text-ink-muted")}>邀请好友</span>

        <button
          onClick={copyCode}
          className={tx(
            "group bg-surface-2 border border-hairline rounded-lg px-3 py-4 flex flex-col items-center gap-1",
            "hover:border-hairline-strong transition-all active:scale-[0.98]",
          )}
          title="点击复制房间号"
        >
          <span className={tx("text-caption text-ink-subtle uppercase tracking-[0.2em]")}>
            房间号
          </span>
          <span
            className={tx("text-display-md font-display font-semibold text-ink tracking-[0.12em]")}
          >
            {roomCode}
          </span>
          <span
            className={tx(
              "text-caption transition-colors",
              codeCopied ? "text-semantic-success" : "text-ink-subtle group-hover:text-ink-muted",
            )}
          >
            {codeCopied ? "✓ 已复制" : "点击复制房间号"}
          </span>
        </button>

        {!isFull && (
          <button
            onClick={copyLink}
            className={tx(
              "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-button font-medium",
              "bg-surface-2 border transition-all active:scale-[0.98]",
              linkCopied
                ? "text-semantic-success border-semantic-success"
                : "text-ink-muted border-hairline hover:text-ink hover:border-hairline-strong",
            )}
          >
            🔗 {linkCopied ? "链接已复制" : "复制房间链接"}
          </button>
        )}

        <p className={tx("text-caption text-ink-tertiary text-center leading-relaxed")}>
          把房间号或链接发给好友
          <br />
          {isFull ? "房间已满" : "满 3 人房主即可开始"}
        </p>
      </div>
    </div>
  );
}
