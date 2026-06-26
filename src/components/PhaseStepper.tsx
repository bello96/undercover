import { tx } from "@twind/core";
import type { GamePhase } from "../types/protocol";

interface Props {
  phase: GamePhase;
}

const STEPS: { key: string; label: string; icon: string }[] = [
  { key: "describing", label: "描述阶段", icon: "✏️" },
  { key: "voting", label: "投票阶段", icon: "🗳️" },
  { key: "reveal", label: "公示结果", icon: "🔓" },
  { key: "next", label: "下一轮", icon: "🔄" },
];

const PHASE_INDEX: Record<string, number> = {
  describing: 0,
  voting: 1,
  reveal: 2,
  ended: 3,
};

/** 底部阶段进度条：描述→投票→公示结果→下一轮，高亮当前阶段（发光）。 */
export default function PhaseStepper({ phase }: Props) {
  const current = PHASE_INDEX[phase] ?? 0;

  return (
    <div
      className={tx(
        "flex items-center justify-center gap-1 bg-surface-1 border border-hairline rounded-xl px-4 py-3 shrink-0",
      )}
    >
      {STEPS.map((step, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div key={step.key} className={tx("flex items-center gap-1")}>
            <div className={tx("flex flex-col items-center gap-1")}>
              <div
                className={tx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-caption transition-all duration-300",
                  isActive
                    ? "bg-primary text-on-primary shadow-focus scale-110"
                    : isDone
                      ? "bg-surface-3 text-ink-muted border border-hairline-strong"
                      : "bg-surface-2 text-ink-tertiary border border-hairline",
                )}
              >
                {step.icon}
              </div>
              <span
                className={tx(
                  "text-caption whitespace-nowrap transition-colors",
                  isActive ? "text-ink font-medium" : "text-ink-tertiary",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={tx(
                  "w-8 h-px mb-4 transition-colors",
                  isDone ? "bg-primary" : "bg-hairline",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
