import { useState } from "react";
import { tx } from "@twind/core";
import { apiUrl } from "../api";

type Mode = "menu" | "create" | "join";

interface HomeProps {
  onEnterRoom: (roomCode: string, name: string) => void;
}

export default function Home({ onEnterRoom }: HomeProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [nickname, setNickname] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const trimmedName = nickname.trim();
  const nameEmpty = trimmedName.length === 0;

  /** 进入二级页（创建 / 加入），清空上一页的错误。 */
  const goSubPage = (next: "create" | "join") => {
    setMode(next);
    setError("");
  };

  /** 返回菜单，复位加入态与错误。 */
  const goMenu = () => {
    setMode("menu");
    setJoinCode("");
    setError("");
  };

  const handleCreate = async () => {
    if (nameEmpty) {
      setError("请输入昵称");
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
      setError("请输入昵称");
      return;
    }
    if (!/^\d{6}$/.test(joinCode)) {
      setError("房间号须为 6 位数字");
      return;
    }
    setError("");
    onEnterRoom(joinCode, trimmedName);
  };

  // ——— 复用样式 ———
  const nameInputCls = tx(
    "w-full bg-surface-2 text-ink text-body rounded-md px-3 py-2.5",
    "border border-hairline outline-none transition-shadow transition-colors",
    "focus:border-primary-focus focus:shadow-focus",
    "placeholder:text-ink-tertiary",
  );

  const labelCls = tx("block text-body-sm font-medium text-ink-muted mb-2");

  const primaryBtnCls = (disabled: boolean): string =>
    tx(
      "w-full py-2.5 px-4 text-button font-medium rounded-md transition-all",
      disabled
        ? "bg-surface-2 text-ink-tertiary cursor-not-allowed border border-hairline"
        : "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98] active:bg-primary-focus",
    );

  const backBtnCls = tx(
    "w-full py-2 text-caption text-ink-subtle hover:text-ink-muted transition-colors",
  );

  const errorBox = error ? (
    <div
      className={tx(
        "mb-4 px-3 py-2 bg-surface-2 border border-semantic-error rounded-md",
        "text-body-sm text-semantic-error animate-[uc-fade-up_240ms_ease-out]",
      )}
    >
      {error}
    </div>
  ) : null;

  // 昵称输入区——创建 / 加入两页共用
  const nameField = (
    <div className={tx("mb-5")}>
      <label className={labelCls}>你的昵称</label>
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="输入昵称（最多10字）"
        maxLength={10}
        autoFocus
        className={nameInputCls}
      />
    </div>
  );

  return (
    <div
      className={tx(
        "relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-12",
      )}
      style={{ background: "linear-gradient(160deg, #eef0fb 0%, #f6f7f9 46%, #edf0f8 100%)" }}
    >
      {/* 背景柔光氛围：低饱和主题色光斑（lavender/青/紫），大模糊 + 低透明，烘托气氛而不抢内容 */}
      <div className={tx("pointer-events-none absolute inset-0")} aria-hidden="true">
        <div
          className={tx("absolute -top-[12%] -left-[8%] w-[60%] h-[60%] rounded-full")}
          style={{
            background: "radial-gradient(circle, rgba(94, 106, 210, 0.22), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className={tx("absolute -bottom-[16%] -right-[10%] w-[55%] h-[55%] rounded-full")}
          style={{
            background: "radial-gradient(circle, rgba(38, 179, 163, 0.14), transparent 70%)",
            filter: "blur(48px)",
          }}
        />
        <div
          className={tx("absolute top-[28%] right-[18%] w-[34%] h-[34%] rounded-full")}
          style={{
            background: "radial-gradient(circle, rgba(155, 106, 210, 0.12), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* 品牌标题区 */}
      <div
        className={tx("relative z-10 text-center mb-9 animate-[uc-fade-up_500ms_ease-out_both]")}
      >
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

      {/* 主卡片（毛玻璃：半透明白 + backdrop-blur，透出背景柔光与光斑） */}
      <div
        className={tx(
          "relative z-10 w-full max-w-sm rounded-xl p-6 border border-[#ffffffb3]",
          "shadow-card-strong animate-[uc-fade-up_600ms_ease-out_both]",
        )}
        style={{
          animationDelay: "80ms",
          background: "rgba(255, 255, 255, 0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* 一级菜单 */}
        {mode === "menu" && (
          <div className={tx("space-y-3 animate-[uc-fade-in_240ms_ease-out]")}>
            <button
              type="button"
              onClick={() => goSubPage("create")}
              className={tx(
                "w-full py-3 px-4 text-button font-medium rounded-md transition-all",
                "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98] active:bg-primary-focus",
                "flex items-center justify-center gap-2",
              )}
            >
              <span>🏠</span>
              <span>创建房间</span>
            </button>
            <button
              type="button"
              onClick={() => goSubPage("join")}
              className={tx(
                "w-full py-3 px-4 text-button font-medium rounded-md transition-all",
                "bg-surface-2 text-ink border border-hairline-strong",
                "hover:border-primary hover:bg-surface-3 active:scale-[0.98]",
                "flex items-center justify-center gap-2",
              )}
            >
              <span>🔗</span>
              <span>加入房间</span>
            </button>
          </div>
        )}

        {/* 创建房间页 */}
        {mode === "create" && (
          <div className={tx("animate-[uc-fade-in_240ms_ease-out]")}>
            {nameField}

            <div className={tx("mb-5")}>
              <label className={labelCls}>房间人数</label>
              <div className={tx("flex gap-2")}>
                {([3, 4, 5, 6] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
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
            </div>

            {errorBox}

            <div className={tx("space-y-1")}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={nameEmpty || creating}
                className={primaryBtnCls(nameEmpty || creating)}
              >
                {creating ? "创建中…" : "确认创建"}
              </button>
              <button type="button" onClick={goMenu} className={backBtnCls}>
                返回
              </button>
            </div>
          </div>
        )}

        {/* 加入房间页（邀请页） */}
        {mode === "join" && (
          <div className={tx("animate-[uc-fade-in_240ms_ease-out]")}>
            {nameField}

            <div className={tx("mb-5")}>
              <label className={labelCls}>房间号</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) {
                    setError("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    handleJoin();
                  }
                }}
                placeholder="输入 6 位房间号"
                maxLength={6}
                className={tx(
                  "w-full bg-surface-2 text-ink rounded-md px-3 py-3 text-center font-mono",
                  "text-2xl tracking-[0.4em]",
                  "border border-hairline outline-none transition-shadow transition-colors",
                  "focus:border-primary-focus focus:shadow-focus",
                  "placeholder:text-ink-tertiary placeholder:text-base placeholder:tracking-[0.15em]",
                )}
              />
            </div>

            {errorBox}

            <div className={tx("space-y-1")}>
              <button
                type="button"
                onClick={handleJoin}
                disabled={nameEmpty || joinCode.length !== 6}
                className={primaryBtnCls(nameEmpty || joinCode.length !== 6)}
              >
                确认加入
              </button>
              <button type="button" onClick={goMenu} className={backBtnCls}>
                返回
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 页脚说明——仅一级菜单展示 */}
      {mode === "menu" && (
        <p
          className={tx(
            "relative z-10 mt-8 text-caption text-ink-tertiary text-center",
            "animate-[uc-fade-in_900ms_ease-out_both]",
          )}
        >
          无需登录，支持 3–6 人在线一起玩
        </p>
      )}
    </div>
  );
}
