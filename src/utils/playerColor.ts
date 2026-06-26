// 玩家专属配色：按玩家在房间中的座位顺序（players 数组 index，与各处「N号」一致）
// 稳定分配。调色板针对 Linear 深色画布挑选，全部配白字（text-on-primary）安全。
// 让原本千篇一律的灰底头像变得一眼可辨——这是辨识度提升的核心。

const PALETTE = [
  "#5e6ad2", // lavender（与品牌主色一致）
  "#3d9ad9", // 蓝
  "#26b3a3", // 青
  "#3aae6b", // 绿
  "#c79a2e", // 琥珀
  "#d9763a", // 橙
  "#d65f6b", // 珊瑚红
  "#c45e9b", // 品红
  "#9b6ad2", // 紫
  "#6d8ad6", // 长春花蓝
] as const;

/** 字符串稳定哈希（djb2），用于无座位上下文时按 id 兜底取色。 */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 按座位序号取色（0-based）。≤10 人时各不相同。 */
export function colorForIndex(index: number): string {
  if (index < 0) {
    return PALETTE[0];
  }
  return PALETTE[index % PALETTE.length];
}

/** 按玩家 id 在 players 列表中的座位取色；找不到则按 id 哈希兜底。 */
export function colorForPlayer(id: string, players: readonly { id: string }[]): string {
  const idx = players.findIndex((p) => p.id === id);
  if (idx >= 0) {
    return colorForIndex(idx);
  }
  return PALETTE[hashString(id) % PALETTE.length];
}
