import { useState, useRef, useEffect, useCallback } from "react";
import { tx } from "@twind/core";
import { useWebSocket } from "../hooks/useWebSocket";
import Lobby from "../components/Lobby";
import TopBar from "../components/TopBar";
import GameSidebar from "../components/GameSidebar";
import PlayerCircle from "../components/PlayerCircle";
import PhaseStepper from "../components/PhaseStepper";
import RulesModal from "../components/RulesModal";
import FeedPanel, { type FeedItem } from "../components/FeedPanel";
import WordRevealOverlay from "../components/WordRevealOverlay";
import RevealOverlay from "../components/RevealOverlay";
import GameOver from "../components/GameOver";
import Toast from "../components/Toast";
import { PLAYER_ID_KEY } from "../App";
import type { GamePhase, PlayerInfo, ServerMessage, Role, Winner } from "../types/protocol";

// 与服务端 constants.MIN_PLAYERS 保持一致（顶栏「N-M 人局」展示用）
const MIN_PLAYERS = 3;

interface Props {
  roomCode: string;
  playerName: string;
  playerId?: string;
  onLeave: () => void;
}

interface VoteResultSnapshot {
  tally: Record<string, number>;
  eliminatedId: string | null;
  eliminatedRole?: Role;
  tiebreak?: { candidates: string[]; round: number };
}

interface GameOverSnapshot {
  winner: Winner;
  undercoverId: string;
  civilianWord: string;
  undercoverWord: string;
  roles: Record<string, Role>;
}

/** 聚合的房间视图状态 —— 消息分发后写入，组件从这里读。 */
interface RoomView {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  maxPlayers: number;
  myId: string | null;
  players: PlayerInfo[];
  round: number;
  deadline: number | undefined;
  feed: FeedItem[]; // 描述（发言）+ 聊天合并的信息流
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  yourWord: string | undefined;
  voteResult: VoteResultSnapshot | null;
  gameOver: GameOverSnapshot | null;
}

const INITIAL_ROOM_VIEW: RoomView = {
  roomCode: "",
  hostId: "",
  phase: "lobby",
  maxPlayers: 6,
  myId: null,
  players: [],
  round: 0,
  deadline: undefined,
  feed: [],
  votedPlayerIds: [],
  tiebreakCandidates: [],
  yourWord: undefined,
  voteResult: null,
  gameOver: null,
};

const nameOf = (players: PlayerInfo[], id: string): string =>
  players.find((p) => p.id === id)?.name ?? "玩家";

export default function Room({ roomCode, playerName, playerId, onLeave }: Props) {
  const [view, setView] = useState<RoomView>(INITIAL_ROOM_VIEW);
  const [joinError, setJoinError] = useState("");
  const [toast, setToast] = useState<{ message: string; id: number; type: "error" | "info" | "success" } | null>(null);
  // 开局「你的词语」浮层：仅在收到 gameStarted 时弹（重连走 roomState 不弹）。
  const [showWordReveal, setShowWordReveal] = useState(false);
  const dismissWordReveal = useCallback(() => setShowWordReveal(false), []);
  const [showRules, setShowRules] = useState(false);

  // 是否曾成功加入（收到 roomState + myId）。重连时跳过 10s 超时。
  const hasJoinedOnceRef = useRef(false);

  const { connected, send, addListener, leave: wsLeave } = useWebSocket(
    roomCode,
    playerName,
    playerId,
  );

  const handleLeave = useCallback(() => {
    wsLeave();
    onLeave();
  }, [wsLeave, onLeave]);

  // ------------------------------------------------------------------
  // listener ref 模式：handler 每 render 重新赋值，闭包看到最新 state；
  // useEffect 依赖只有 addListener，注册一次，永不卸载。
  // 不可退化为依赖数组模式，否则 roomState 等关键消息会在 listener 重注册
  // 的空窗期丢失，导致客户端永远卡在「连接中」。
  // ------------------------------------------------------------------
  const messageHandlerRef = useRef<(msg: ServerMessage) => void>(() => {});

  messageHandlerRef.current = (msg: ServerMessage) => {
    switch (msg.type) {
      case "roomState": {
        // 关键：写入 sessionStorage 以便刷新后重连
        sessionStorage.setItem(PLAYER_ID_KEY, msg.yourId);
        const players = msg.players;
        const descItems: FeedItem[] = (msg.descriptions ?? []).map((d) => ({
          id: `d-${d.round}-${d.playerId}`,
          kind: "describe",
          playerId: d.playerId,
          playerName: nameOf(players, d.playerId),
          text: d.text,
          round: d.round,
        }));
        const chatItems: FeedItem[] = (msg.chatHistory ?? []).map((c, i) => ({
          id: `c-${c.timestamp}-${i}`,
          kind: "chat",
          playerId: c.playerId,
          playerName: c.playerName,
          text: c.text,
        }));
        setView({
          roomCode: msg.roomCode,
          hostId: msg.hostId,
          phase: msg.phase,
          maxPlayers: msg.maxPlayers,
          myId: msg.yourId,
          players,
          round: msg.round,
          deadline: msg.deadline,
          // 重连最佳努力顺序：历史聊天在前、本轮描述在后（无逐条时间戳，跨轮顺序略有损）
          feed: [...chatItems, ...descItems],
          votedPlayerIds: msg.votedPlayerIds ?? [],
          tiebreakCandidates: msg.tiebreakCandidates ?? [],
          yourWord: msg.yourWord,
          voteResult: null,
          gameOver: null,
        });
        break;
      }

      case "playerJoined": {
        setView((prev) => ({
          ...prev,
          players: [...prev.players, msg.player],
        }));
        break;
      }

      case "playerLeft": {
        if (msg.revealedRole) {
          const roleName = msg.revealedRole === "undercover" ? "卧底" : "平民";
          setView((prev) => {
            const leaving = prev.players.find((p) => p.id === msg.playerId);
            const name = leaving?.name ?? "玩家";
            setToast({ message: `${name}（${roleName}）离开了`, id: Date.now(), type: "info" });
            return {
              ...prev,
              players: prev.players.filter((p) => p.id !== msg.playerId),
            };
          });
        } else {
          setView((prev) => ({
            ...prev,
            players: prev.players.filter((p) => p.id !== msg.playerId),
          }));
        }
        break;
      }

      case "gameStarted": {
        // 开局：弹「你的词语」浮层 + 进入首轮描述 + 清空信息流（新对局）
        setShowWordReveal(true);
        setView((prev) => ({
          ...prev,
          yourWord: msg.yourWord,
          phase: "describing",
          deadline: msg.deadline,
          round: msg.round,
          voteResult: null,
          gameOver: null,
          feed: [],
          votedPlayerIds: [],
          tiebreakCandidates: [],
        }));
        break;
      }

      case "phaseChange": {
        setView((prev) => {
          const enteringDescribing = msg.phase === "describing";
          const enteringVoting = msg.phase === "voting";
          return {
            ...prev,
            phase: msg.phase,
            round: msg.round ?? prev.round,
            deadline: msg.deadline ?? prev.deadline,
            tiebreakCandidates: msg.tiebreakCandidates ?? [],
            // 进入 reveal 时保留 voteResult（揭晓需要它）；其余阶段清除
            voteResult: msg.phase === "reveal" ? prev.voteResult : null,
            // 进入描述/投票（含加赛重投）清空已投票；信息流跨轮累积不清空
            votedPlayerIds: enteringDescribing || enteringVoting ? [] : prev.votedPlayerIds,
          };
        });
        break;
      }

      case "describeUpdate": {
        // 同时作答：任意存活者提交即广播，汇入信息流；去重（重连后 roomState 已含本轮）
        setView((prev) => {
          const dupId = `d-${msg.round}-${msg.playerId}`;
          if (prev.feed.some((it) => it.id === dupId)) {
            return prev;
          }
          const item: FeedItem = {
            id: dupId,
            kind: "describe",
            playerId: msg.playerId,
            playerName: nameOf(prev.players, msg.playerId),
            text: msg.text,
            round: msg.round,
          };
          return { ...prev, feed: [...prev.feed, item] };
        });
        break;
      }

      case "voteUpdate": {
        setView((prev) => ({
          ...prev,
          votedPlayerIds: prev.votedPlayerIds.includes(msg.voterId)
            ? prev.votedPlayerIds
            : [...prev.votedPlayerIds, msg.voterId],
        }));
        break;
      }

      case "voteResult": {
        setView((prev) => ({
          ...prev,
          voteResult: {
            tally: msg.tally,
            eliminatedId: msg.eliminatedId,
            eliminatedRole: msg.eliminatedRole,
            tiebreak: msg.tiebreak,
          },
          // 有出局者时本地立即标记出局，不等待 roomState 重发 players
          players: msg.eliminatedId
            ? prev.players.map((p) =>
                p.id === msg.eliminatedId ? { ...p, alive: false } : p,
              )
            : prev.players,
        }));
        break;
      }

      case "gameOver": {
        setView((prev) => ({
          ...prev,
          phase: "ended",
          gameOver: {
            winner: msg.winner,
            undercoverId: msg.undercoverId,
            civilianWord: msg.civilianWord,
            undercoverWord: msg.undercoverWord,
            roles: msg.roles,
          },
        }));
        break;
      }

      case "chat": {
        setView((prev) => {
          const item: FeedItem = {
            id: `c-${msg.timestamp}-${prev.feed.length}`,
            kind: "chat",
            playerId: msg.playerId,
            playerName: msg.playerName,
            text: msg.text,
          };
          return { ...prev, feed: [...prev.feed, item] };
        });
        break;
      }

      case "error": {
        // 「游戏已开始，无法加入」是会话级致命错误：服务端随即关闭连接，
        // 且重连仍会被拒。无论是否已加入都走 joinError 统一退出，避免卡在
        // 「网络异常，正在重连…」假象里反复弹窗。其余错误：未加入走 joinError
        // 统一退出，已加入仅弹 toast（如「至少需要 3 人才能开始」）。
        if (msg.message === "游戏已开始，无法加入" || !view.myId) {
          setJoinError(msg.message);
        } else {
          setToast({ message: msg.message, id: Date.now(), type: "error" });
        }
        break;
      }

      case "roomClosed": {
        // 走 joinError 路径，1.5s 后退出
        setJoinError(`房间已关闭：${msg.reason}`);
        break;
      }

      default:
        break;
    }
  };

  // 注册一次，永不卸载——关键！不要在依赖数组中包含任何 state
  useEffect(() => {
    return addListener((msg) => messageHandlerRef.current(msg));
  }, [addListener]);

  // ------------------------------------------------------------------
  // join 超时兜底：首次 10s 内仍无 myId → setJoinError → 统一退出。
  // 重连场景（hasJoinedOnce 为 true）跳过此超时。
  // ------------------------------------------------------------------
  useEffect(() => {
    if (view.myId !== null) {
      hasJoinedOnceRef.current = true;
      return;
    }
    if (hasJoinedOnceRef.current) {
      // 已加入过，这是重连等待，不超时
      return;
    }
    if (joinError) {
      return;
    }
    const timer = window.setTimeout(() => {
      setJoinError("加入房间超时，请检查网络或刷新页面");
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [view.myId, joinError]);

  // joinError 统一退出：1.5s 后调用 onLeave
  useEffect(() => {
    if (!joinError) {
      return;
    }
    const timer = window.setTimeout(() => onLeave(), 1500);
    return () => window.clearTimeout(timer);
  }, [joinError, onLeave]);

  // ------------------------------------------------------------------
  // 渲染：未加入 / 出错 → 全屏提示
  // ------------------------------------------------------------------
  if (!view.myId || joinError) {
    return (
      <div className={tx("flex items-center justify-center min-h-screen bg-canvas text-ink")}>
        <div className={tx("text-center")}>
          {joinError ? (
            <>
              <div className={tx("text-body-lg text-semantic-error mb-2 font-medium")}>
                {joinError}
              </div>
              <div className={tx("text-body-sm text-ink-subtle")}>即将返回首页...</div>
            </>
          ) : (
            <>
              <div
                className={tx(
                  "w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4",
                )}
              />
              <div className={tx("text-ink-muted")}>连接中...</div>
            </>
          )}
        </div>
      </div>
    );
  }

  const {
    phase,
    players,
    hostId,
    maxPlayers,
    myId,
    yourWord,
    feed,
    votedPlayerIds,
    round,
    tiebreakCandidates,
    voteResult,
    gameOver,
  } = view;

  const meInfo = players.find((p) => p.id === myId);
  const iAmEliminated = meInfo ? !meInfo.alive : false;
  const inGame = phase === "describing" || phase === "voting" || phase === "reveal";

  // 当前轮已提交描述者（头像状态用）—— 从信息流按轮次推导
  const submittedIds = feed
    .filter((it) => it.kind === "describe" && it.round === round)
    .map((it) => it.playerId);

  const reconnectBanner = !connected && (
    <div
      className={tx(
        "bg-surface-2 border-b border-hairline text-center text-caption py-2 text-ink-muted shrink-0",
      )}
    >
      网络异常，正在重连...
    </div>
  );

  const toastEl = toast && (
    <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
  );

  // 大厅：全屏（可自然增高/滚动）
  if (phase === "lobby") {
    return (
      <div className={tx("min-h-screen bg-canvas text-ink")}>
        {reconnectBanner}
        {toastEl}
        <Lobby
          roomCode={roomCode}
          players={players}
          hostId={hostId}
          maxPlayers={maxPlayers}
          myId={myId}
          send={send}
        />
      </div>
    );
  }

  // 游戏中 / 结算：顶栏 + 三栏（左信息 / 中环形+进度条 / 右聊天流），覆盖层叠加
  return (
    <div className={tx("h-screen bg-canvas text-ink flex flex-col overflow-hidden")}>
      {reconnectBanner}
      {toastEl}

      {showWordReveal && yourWord && (
        <WordRevealOverlay word={yourWord} onDismiss={dismissWordReveal} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {inGame && (
        <>
          <TopBar
            roomCode={roomCode}
            round={round}
            phase={phase}
            deadline={view.deadline}
            minPlayers={MIN_PLAYERS}
            maxPlayers={maxPlayers}
            onLeave={handleLeave}
            onShowRules={() => setShowRules(true)}
          />

          <div className={tx("flex-1 flex gap-3 p-3 min-h-0 overflow-hidden")}>
            {/* 左：信息栏 */}
            <div className={tx("w-[264px] shrink-0 overflow-y-auto min-h-0")}>
              <GameSidebar
                word={yourWord}
                eliminated={iAmEliminated}
                playerCount={players.length}
                maxPlayers={maxPlayers}
                round={round}
                phase={phase}
              />
            </div>

            {/* 中：环形玩家 + 阶段进度条 */}
            <div className={tx("flex-1 flex flex-col gap-3 min-h-0 min-w-0")}>
              <PlayerCircle
                players={players}
                myId={myId}
                hostId={hostId}
                phase={phase}
                submittedIds={submittedIds}
                votedPlayerIds={votedPlayerIds}
                tiebreakCandidates={tiebreakCandidates}
                voteResult={voteResult}
                onSubmitDescribe={(text) => send({ type: "describe", text })}
                onVote={(targetId) => send({ type: "vote", targetId })}
              />
              <PhaseStepper phase={phase} />
            </div>

            {/* 右：聊天 / 发言流 */}
            <div className={tx("w-[336px] shrink-0 min-h-0")}>
              <FeedPanel
                items={feed}
                players={players}
                myId={myId}
                onSend={(text) => send({ type: "chat", text })}
              />
            </div>
          </div>
        </>
      )}

      {/* 出局揭晓覆盖层（reveal 阶段叠加在主区之上） */}
      {phase === "reveal" && voteResult !== null && (
        <RevealOverlay
          eliminatedId={voteResult.eliminatedId}
          eliminatedRole={voteResult.eliminatedRole}
          players={players}
        />
      )}

      {/* 结算覆盖层 */}
      {phase === "ended" && gameOver !== null && (
        <GameOver
          winner={gameOver.winner}
          undercoverId={gameOver.undercoverId}
          civilianWord={gameOver.civilianWord}
          undercoverWord={gameOver.undercoverWord}
          roles={gameOver.roles}
          players={players}
          isHost={hostId === myId}
          onNextGame={() => send({ type: "nextGame" })}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
