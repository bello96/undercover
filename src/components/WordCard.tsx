import { tx } from "@twind/core";

interface Props {
  word?: string;
  eliminated: boolean;
}

/**
 * 展示当前玩家的词（大字卡片）。
 * 绝不显示身份（平民/卧底）——只显示词本身。
 * 已出局玩家显示「你已出局（观战中）」。
 */
export default function WordCard({ word, eliminated }: Props) {
  if (eliminated) {
    return (
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-8 py-6",
          "flex flex-col items-center gap-2 text-center",
        )}
      >
        <p className={tx("text-body-sm text-ink-subtle uppercase tracking-widest")}>
          你的状态
        </p>
        <p className={tx("text-subhead font-display font-semibold text-ink-muted")}>
          你已出局（观战中）
        </p>
      </div>
    );
  }

  return (
    <div
      className={tx(
        "bg-surface-1 border border-hairline rounded-xl px-8 py-6",
        "flex flex-col items-center gap-2 text-center",
      )}
    >
      <p className={tx("text-body-sm text-ink-subtle uppercase tracking-widest")}>
        你的词
      </p>
      {word ? (
        <p
          className={tx(
            "text-display-md font-display font-semibold text-ink",
            "tracking-tight",
          )}
        >
          {word}
        </p>
      ) : (
        <p className={tx("text-subhead text-ink-subtle")}>加载中…</p>
      )}
    </div>
  );
}
