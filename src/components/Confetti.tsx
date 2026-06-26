import { useEffect, useRef, useState } from "react";
import { tx } from "@twind/core";

// 庆祝彩屑：canvas + requestAnimationFrame 驱动，碎片全部落屏外后自动卸载。
// 移植自 draw-guess，参数化碎片数与配色（卧底局/平民局可用不同色）。

const DEFAULT_PIECE_COUNT = 180;
const MAX_DELAY_MS = 1800;
const DELAY_DISTRIBUTION_POWER = 2;
const DURATION_MIN_MS = 2500;
const DURATION_MAX_MS = 4000;
const SWAY_AMPLITUDE_PX = 50;
const SIZE_MIN_PX = 5;
const SIZE_MAX_PX = 10;
const ROTATION_TURNS = 1;

const SHAPES: ConfettiShape[] = ["circle", "rect", "strip"];

/** 默认明亮配色池。 */
const DEFAULT_COLORS = [
  "#5e6ad2",
  "#828fff",
  "#3d9ad9",
  "#48dbfb",
  "#26b3a3",
  "#2ed573",
  "#7bed9f",
  "#c79a2e",
  "#ffd32a",
  "#d9763a",
  "#d65f6b",
  "#c45e9b",
  "#e056fd",
  "#a29bfe",
];

type ConfettiShape = "circle" | "rect" | "strip";

interface ConfettiPiece {
  startX: number;
  delay: number;
  duration: number;
  sway: number;
  color: string;
  size: number;
  shape: ConfettiShape;
  rotationStart: number;
}

interface Props {
  pieceCount?: number;
  colors?: string[];
}

function createConfetti(count: number, width: number, colors: string[]): ConfettiPiece[] {
  const durRange = DURATION_MAX_MS - DURATION_MIN_MS;
  const sizeRange = SIZE_MAX_PX - SIZE_MIN_PX;
  return Array.from({ length: count }, () => {
    const r = Math.random();
    return {
      startX: Math.random() * width,
      delay: Math.pow(r, DELAY_DISTRIBUTION_POWER) * MAX_DELAY_MS,
      duration: DURATION_MIN_MS + Math.random() * durRange,
      sway: -SWAY_AMPLITUDE_PX + Math.random() * 2 * SWAY_AMPLITUDE_PX,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: SIZE_MIN_PX + Math.random() * sizeRange,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      rotationStart: Math.random() * Math.PI * 2,
    };
  });
}

function drawConfettiPiece(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  piece: ConfettiPiece,
  alpha: number,
  rotation: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = piece.color;
  if (piece.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (piece.shape === "rect") {
    ctx.fillRect(-piece.size / 2, (-piece.size * 0.6) / 2, piece.size, piece.size * 0.6);
  } else {
    const w = piece.size * 0.35;
    const h = piece.size * 1.8;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

export default function Confetti({
  pieceCount = DEFAULT_PIECE_COUNT,
  colors = DEFAULT_COLORS,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();

    const confetti = createConfetti(pieceCount, canvas.width, colors);
    const startT = performance.now();
    let rafId: number | null = null;

    const tick = (now: number) => {
      const elapsed = now - startT;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;

      for (const p of confetti) {
        if (elapsed < p.delay) {
          alive++;
          continue;
        }
        const localT = elapsed - p.delay;
        if (localT >= p.duration) {
          continue;
        }
        alive++;
        const progress = localT / p.duration;
        const y = -20 + progress * (canvas.height + 40);
        const swayMul = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 1.5;
        const x = p.startX + p.sway * swayMul;
        const rotation = p.rotationStart + progress * Math.PI * 2 * ROTATION_TURNS;
        drawConfettiPiece(ctx, x, y, p, 1, rotation);
      }

      if (alive === 0) {
        setVisible(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const onResize = () => setSize();
    window.addEventListener("resize", onResize);
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", onResize);
    };
  }, [pieceCount, colors]);

  if (!visible) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={tx("fixed inset-0 pointer-events-none")}
      style={{ zIndex: 9999 }}
    />
  );
}
