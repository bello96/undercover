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

  // In room
  if (roomCode) {
    return (
      <Room
        roomCode={roomCode}
        playerName={playerName}
        playerId={playerId}
        onLeave={leaveRoom}
      />
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
