import type { ReactNode } from "react";
import { tx } from "@twind/core";

interface Props {
  onClose: () => void;
}

/** 规则说明弹窗（静态文案，由顶部「规则」按钮触发）。 */
export default function RulesModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      className={tx(
        "fixed inset-0 z-50 flex items-center justify-center p-4 bg-semantic-overlay bg-opacity-70",
        "animate-[uc-overlay-in_200ms_ease-out]",
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl shadow-card-strong",
          "max-w-md w-full max-h-[80vh] overflow-y-auto p-6 flex flex-col gap-4",
          "animate-[uc-pop-in_280ms_ease-out]",
        )}
      >
        <div className={tx("flex items-center justify-between")}>
          <h2 className={tx("text-card-title font-display font-semibold text-ink")}>游戏规则</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className={tx(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "text-ink-subtle hover:text-ink hover:bg-surface-3 transition-colors",
            )}
          >
            ✕
          </button>
        </div>
        <div className={tx("flex flex-col gap-3")}>
          <Section title="🎭 角色">
            N 人中有 N−1 名平民和 1
            名卧底。平民拿到同一个词，卧底拿到相近但不同的词。你只能看到自己的词，看不到自己的身份——靠推理判断谁是卧底。
          </Section>
          <Section title="🔁 回合">
            每轮分三步：①描述——所有存活玩家同时用一句话描述自己的词（不能直接说出词本身）；②投票——同时投出你认为的卧底，不能投自己；③公示——得票最高者出局并亮明身份。
          </Section>
          <Section title="🏆 胜负">
            卧底被票出 → 平民获胜；若场上只剩 2 人时卧底仍未出局 →
            卧底获胜。平票则对并列者加赛一轮，仍平票本轮无人淘汰。
          </Section>
          <Section title="⏱ 计时">描述 45 秒、投票 30 秒，超时自动跳过 / 弃票。</Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={tx("flex flex-col gap-1")}>
      <h3 className={tx("text-body-sm font-medium text-ink")}>{title}</h3>
      <p className={tx("text-body-sm text-ink-muted leading-relaxed")}>{children}</p>
    </div>
  );
}
