import { useState, useEffect, useCallback } from "react";
import { tx } from "@twind/core";
import Home from "./pages/Home";
import Room from "./pages/Room";

const NICKNAME_KEY = "undercover-nickname";
const PLAYER_ID_KEY = "undercover-playerId";

/** Extract a 6-digit room code from the URL path, e.g. /438907 */
function getRoomCodeFromUrl(): string {
  const match = window.location.pathname.match(/^\/(\d{6})$/);
  return match ? match[1] : "";
}

/** 默认昵称「玩家1234」，供深链接入房预填。 */
function defaultNickname(): string {
  return `玩家${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function App() {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState<string | undefined>(undefined);

  // 深链接入房：访问 /房间号 时弹昵称框直接进，无需回首页重输房号
  const [urlJoinCode, setUrlJoinCode] = useState("");
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [modalName, setModalName] = useState("");

  const enterRoom = useCallback((code: string, name: string, existingPlayerId?: string) => {
    setPlayerName(name);
    setRoomCode(code);
    if (existingPlayerId) {
      setPlayerId(existingPlayerId);
    }
    sessionStorage.setItem(NICKNAME_KEY, name);
    window.history.replaceState(null, "", `/${code}`);
  }, []);

  // Check URL on mount for room code (refresh/direct URL access)
  useEffect(() => {
    const code = getRoomCodeFromUrl();
    if (!code) {
      return;
    }

    const savedName = sessionStorage.getItem(NICKNAME_KEY);
    const savedPlayerId = sessionStorage.getItem(PLAYER_ID_KEY) ?? undefined;

    // 重连（刷新页面）—— 直接进，服务端在 WS join 校验
    if (savedName && savedPlayerId) {
      enterRoom(code, savedName, savedPlayerId);
      return;
    }
    // 新访客点开房间链接 —— 弹昵称框（预填默认昵称），确认即进房
    setUrlJoinCode(code);
    setModalName(defaultNickname());
    setShowNicknameModal(true);
  }, [enterRoom]);

  const leaveRoom = useCallback(() => {
    setRoomCode("");
    setPlayerName("");
    setPlayerId(undefined);
    sessionStorage.removeItem(NICKNAME_KEY);
    sessionStorage.removeItem(PLAYER_ID_KEY);
    window.history.replaceState(null, "", "/");
  }, []);

  const handleNicknameConfirm = useCallback(() => {
    const name = modalName.trim();
    if (!name) {
      return;
    }
    setShowNicknameModal(false);
    enterRoom(urlJoinCode, name);
  }, [modalName, urlJoinCode, enterRoom]);

  const handleNicknameCancel = useCallback(() => {
    setShowNicknameModal(false);
    setUrlJoinCode("");
    window.history.replaceState(null, "", "/");
  }, []);

  // In room
  if (roomCode) {
    return (
      <Room roomCode={roomCode} playerName={playerName} playerId={playerId} onLeave={leaveRoom} />
    );
  }

  // 深链接入房昵称框（覆盖首页）
  if (showNicknameModal) {
    return (
      <div
        className={tx(
          "min-h-screen bg-canvas flex items-center justify-center px-4 animate-[uc-fade-in_200ms_ease-out]",
        )}
      >
        <div
          className={tx(
            "w-full max-w-sm bg-surface-1 border border-hairline rounded-xl p-6 flex flex-col gap-4",
            "shadow-card-strong animate-[uc-pop-in_280ms_ease-out]",
          )}
        >
          <div className={tx("flex flex-col gap-1")}>
            <h2 className={tx("text-card-title font-display font-semibold text-ink")}>
              加入房间 <span className={tx("font-mono text-primary")}>{urlJoinCode}</span>
            </h2>
            <p className={tx("text-body-sm text-ink-muted")}>输入你的昵称即可进入房间</p>
          </div>
          <input
            type="text"
            value={modalName}
            onChange={(e) => setModalName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleNicknameConfirm();
              }
            }}
            placeholder="输入昵称（最多10字）"
            maxLength={10}
            autoFocus
            className={tx(
              "w-full bg-surface-2 text-ink text-body rounded-md px-3 py-2.5",
              "border border-hairline outline-none transition-shadow transition-colors",
              "focus:border-primary-focus focus:shadow-focus",
              "placeholder:text-ink-tertiary",
            )}
          />
          <button
            onClick={handleNicknameConfirm}
            disabled={!modalName.trim()}
            className={tx(
              "w-full py-2.5 px-4 text-button font-medium rounded-md transition-all",
              modalName.trim()
                ? "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98]"
                : "bg-surface-2 text-ink-tertiary border border-hairline cursor-not-allowed",
            )}
          >
            进入房间
          </button>
          <button
            onClick={handleNicknameCancel}
            className={tx("text-caption text-ink-subtle hover:text-ink-muted transition-colors")}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // Default: Home page
  return (
    <div className={tx("min-h-screen bg-canvas")}>
      <Home onEnterRoom={enterRoom} />
    </div>
  );
}

// Expose playerId for other components to read (via sessionStorage)
export { PLAYER_ID_KEY };
