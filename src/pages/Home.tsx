import { useState } from "react";
import { tx } from "@twind/core";
import { apiUrl } from "../api";

interface HomeProps {
  onEnterRoom: (roomCode: string, name: string) => void;
}

export default function Home({ onEnterRoom }: HomeProps) {
  const [nickname, setNickname] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const trimmedName = nickname.trim();
  const nameEmpty = trimmedName.length === 0;

  const handleCreate = async () => {
    if (nameEmpty) {
      return;
    }
    setError("");
    setCreating(true);
    try {
      const res = await fetch(apiUrl(`/api/rooms?max=${maxPlayers}`), { method: "POST" });
      if (!res.ok) {
        throw new Error(`建房失败（${res.status}）`);
      }
      const data = (await res.json()) as { roomCode: string };
      onEnterRoom(data.roomCode, trimmedName);
    } catch (e) {
      const isOwnError = e instanceof Error && e.message.startsWith("建房失败");
      setError(isOwnError ? (e as Error).message : "网络连接失败，请检查网络后重试");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    if (nameEmpty) {
      return;
    }
    if (!/^\d{6}$/.test(joinCode)) {
      setError("房间号须为 6 位数字");
      return;
    }
    setError("");
    onEnterRoom(joinCode, trimmedName);
  };

  const inputCls = tx(
    "w-full bg-surface-2 text-ink text-body rounded-md px-3 py-2.5",
    "border border-hairline outline-none transition-shadow transition-colors",
    "focus:border-primary-focus focus:shadow-focus",
    "placeholder:text-ink-tertiary",
  );

  return (
    <div
      className={tx("min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12")}
    >
      {/* 品牌标题区 */}
      <div className={tx("text-center mb-9 animate-[uc-fade-up_500ms_ease-out_both]")}>
        <div
          className={tx(
            "w-14 h-14 mx-auto mb-4 rounded-xl bg-primary flex items-center justify-center",
            "text-[28px] shadow-card-strong",
          )}
        >
          🕵️
        </div>
        <h1
          className={tx("font-display text-display-md font-semibold text-ink mb-2 tracking-tight")}
        >
          谁是卧底
        </h1>
        <p className={tx("text-body text-ink-muted")}>3–6 人在线联机，找出隐藏的卧底</p>
      </div>

      {/* 主卡片 */}
      <div
        className={tx(
          "w-full max-w-sm bg-surface-1 rounded-xl border border-hairline p-6",
          "shadow-card animate-[uc-fade-up_600ms_ease-out_both]",
        )}
        style={{ animationDelay: "80ms" }}
      >
        {/* 昵称输入 */}
        <div className={tx("mb-5")}>
          <label className={tx("block text-body-sm font-medium text-ink-muted mb-2")}>
            你的昵称
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="输入昵称（最多10字）"
            maxLength={10}
            autoFocus
            className={inputCls}
          />
        </div>

        <div className={tx("border-t border-hairline mb-5")} />

        {/* 创建房间区 */}
        <div className={tx("mb-5")}>
          <p className={tx("text-body-sm font-medium text-ink-muted mb-3")}>创建房间</p>

          {/* 人数选择 */}
          <div className={tx("flex gap-2 mb-3")}>
            {([3, 4, 5, 6] as const).map((n) => (
              <button
                key={n}
                onClick={() => setMaxPlayers(n)}
                className={tx(
                  "flex-1 py-2 text-button font-medium rounded-md transition-all active:scale-95",
                  maxPlayers === n
                    ? "bg-primary text-on-primary shadow-card"
                    : "bg-surface-2 text-ink-muted border border-hairline hover:text-ink hover:border-hairline-strong",
                )}
              >
                {n} 人
              </button>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={nameEmpty || creating}
            className={tx(
              "w-full py-2.5 px-4 text-button font-medium rounded-md transition-all",
              nameEmpty || creating
                ? "bg-surface-2 text-ink-tertiary cursor-not-allowed border border-hairline"
                : "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98] active:bg-primary-focus",
            )}
          >
            {creating ? "创建中…" : "创建房间"}
          </button>
        </div>

        <div className={tx("border-t border-hairline mb-5")} />

        {/* 加入房间区 */}
        <div>
          <p className={tx("text-body-sm font-medium text-ink-muted mb-3")}>加入房间</p>
          <div className={tx("flex gap-2")}>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              value={joinCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setJoinCode(val);
                if (error) {
                  setError("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJoin();
                }
              }}
              placeholder="6 位房间号"
              maxLength={6}
              className={tx(
                "flex-1 bg-surface-2 text-ink text-body rounded-md px-3 py-2.5 tracking-[0.3em]",
                "border border-hairline outline-none transition-shadow transition-colors",
                "focus:border-primary-focus focus:shadow-focus",
                "placeholder:text-ink-tertiary placeholder:tracking-normal font-mono",
              )}
            />
            <button
              onClick={handleJoin}
              disabled={nameEmpty || joinCode.length !== 6}
              className={tx(
                "px-4 py-2.5 text-button font-medium rounded-md transition-all whitespace-nowrap",
                nameEmpty || joinCode.length !== 6
                  ? "bg-surface-2 text-ink-tertiary cursor-not-allowed border border-hairline"
                  : "bg-surface-1 text-ink border border-hairline-strong hover:bg-surface-2 active:scale-[0.98]",
              )}
            >
              加入
            </button>
          </div>
          {nameEmpty && (
            <p className={tx("mt-2 text-caption text-ink-subtle")}>请先填写昵称再进房</p>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div
            className={tx(
              "mt-4 px-3 py-2 bg-surface-2 border border-semantic-error rounded-md",
              "text-body-sm text-semantic-error animate-[uc-fade-up_240ms_ease-out]",
            )}
          >
            {error}
          </div>
        )}
      </div>

      {/* 页脚说明 */}
      <p
        className={tx(
          "mt-8 text-caption text-ink-tertiary text-center animate-[uc-fade-in_900ms_ease-out_both]",
        )}
      >
        无需注册 · 房间自动关闭
      </p>
    </div>
  );
}
