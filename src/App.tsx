import { useState, useEffect, useCallback } from "react";
import { tx } from "@twind/core";
import Home from "./pages/Home";

const NICKNAME_KEY = "undercover-nickname";
const PLAYER_ID_KEY = "undercover-playerId";

/** Extract a 6-digit room code from the URL path, e.g. /438907 */
function getRoomCodeFromUrl(): string {
  const match = window.location.pathname.match(/^\/(\d{6})$/);
  return match ? match[1] : "";
}

export default function App() {
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState<string | undefined>(undefined);

  // Check URL on mount for room code (refresh/direct URL access)
  useEffect(() => {
    const code = getRoomCodeFromUrl();
    if (!code) {
      return;
    }

    const savedName = sessionStorage.getItem(NICKNAME_KEY);
    const savedPlayerId = sessionStorage.getItem(PLAYER_ID_KEY) ?? undefined;

    // Reconnection (page refresh) — go directly, server validates on WS join
    if (savedName && savedPlayerId) {
      enterRoom(code, savedName, savedPlayerId);
    }
    // If no saved session, just stay on Home — user can enter nickname and join
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enterRoom = useCallback((code: string, name: string, existingPlayerId?: string) => {
    setPlayerName(name);
    setRoomCode(code);
    if (existingPlayerId) {
      setPlayerId(existingPlayerId);
    }
    sessionStorage.setItem(NICKNAME_KEY, name);
    window.history.replaceState(null, "", `/${code}`);
  }, []);

  const leaveRoom = useCallback(() => {
    setRoomCode("");
    setPlayerName("");
    setPlayerId(undefined);
    sessionStorage.removeItem(NICKNAME_KEY);
    sessionStorage.removeItem(PLAYER_ID_KEY);
    window.history.replaceState(null, "", "/");
  }, []);

  // In room — next unit (Task 10) will replace this placeholder with <Room />
  if (roomCode) {
    return (
      <div className={tx("min-h-screen bg-canvas text-ink flex items-center justify-center p-8")}>
        <div
          className={tx(
            "bg-surface-1 border border-hairline rounded-lg p-8 text-center max-w-sm w-full",
          )}
        >
          <p className={tx("text-ink-muted text-body-sm mb-1")}>房间号</p>
          <p className={tx("text-display-md font-display font-semibold text-ink mb-6 tracking-widest")}>
            {roomCode}
          </p>
          <p className={tx("text-ink-subtle text-body-sm mb-6")}>游戏界面建设中</p>
          <button
            onClick={leaveRoom}
            className={tx(
              "px-4 py-2 bg-surface-2 text-ink text-button font-medium rounded-md",
              "border border-hairline hover:border-hairline-strong transition-colors",
            )}
          >
            离开房间
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
