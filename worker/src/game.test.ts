// worker/src/game.test.ts
import { describe, it, expect } from "vitest";
import {
  pickUndercover,
  tallyVotes,
  checkWin,
  resolveAfterReveal,
  parseWordPair,
  pickFallback,
} from "./game";

describe("pickUndercover", () => {
  it("从玩家中选出一个，索引由注入的 rand 决定", () => {
    const ids = ["a", "b", "c"];
    expect(pickUndercover(ids, () => 0)).toBe("a");
    expect(pickUndercover(ids, () => 0.99)).toBe("c"); // floor(0.99*3)=2
  });
});

describe("tallyVotes", () => {
  it("唯一最高票", () => {
    const r = tallyVotes({ a: "x", b: "x", c: "y" });
    expect(r.counts).toEqual({ x: 2, y: 1 });
    expect(r.topIds).toEqual(["x"]);
  });
  it("平票返回多个候选", () => {
    const r = tallyVotes({ a: "x", b: "y" });
    expect(r.counts).toEqual({ x: 1, y: 1 });
    expect(r.topIds.sort()).toEqual(["x", "y"]);
  });
  it("无人投票时 topIds 为空", () => {
    expect(tallyVotes({}).topIds).toEqual([]);
  });
});

describe("checkWin", () => {
  it("出局者是卧底 → 平民胜", () => {
    expect(checkWin("undercover", 5)).toBe("civilian");
  });
  it("出局平民后只剩2人 → 卧底胜", () => {
    expect(checkWin("civilian", 2)).toBe("undercover");
  });
  it("存活不足2人（边界）→ 卧底胜", () => {
    expect(checkWin("civilian", 1)).toBe("undercover");
  });
  it("出局平民但仍>2人 → 继续", () => {
    expect(checkWin("civilian", 3)).toBeNull();
  });
  it("平票无人出局 → 继续", () => {
    expect(checkWin(null, 4)).toBeNull();
  });
});

describe("resolveAfterReveal", () => {
  const T = 2; // 僵局阈值，对应 constants.MAX_NO_ELIM_ROUNDS

  it("出局卧底 → 平民胜（优先于僵局判定）", () => {
    expect(resolveAfterReveal("undercover", 5, 9, T)).toBe("civilian");
  });
  it("出局平民后只剩 2 人 → 卧底胜", () => {
    expect(resolveAfterReveal("civilian", 2, 0, T)).toBe("undercover");
  });
  it("出局平民但仍 >2 人、未达僵局 → 继续", () => {
    expect(resolveAfterReveal("civilian", 3, 0, T)).toBeNull();
  });
  it("首次平票无人淘汰（streak=1）→ 继续", () => {
    expect(resolveAfterReveal(null, 4, 1, T)).toBeNull();
  });
  // 复现并修复用户报告的死循环：掉线/挂机/僵尸连接占位使存活数虚高(>2)，
  // 两名真实玩家互投永远平票、无人被淘汰 —— 旧逻辑 checkWin(null,3) 恒为 null 故永不结束；
  // 连续无淘汰达阈值即判僵局结束（卧底胜），打破死循环。
  it("连续无人淘汰达阈值 → 判僵局卧底胜（即便存活数仍 >2）", () => {
    expect(resolveAfterReveal(null, 3, 2, T)).toBe("undercover");
  });
  it("连续无人淘汰达阈值但存活仍 >2，超过阈值同样结束", () => {
    expect(resolveAfterReveal(null, 5, 3, T)).toBe("undercover");
  });
});

describe("parseWordPair", () => {
  it("解析合法 JSON", () => {
    expect(parseWordPair('{"civilianWord":"猫","undercoverWord":"狗"}'))
      .toEqual({ civilianWord: "猫", undercoverWord: "狗" });
  });
  it("容忍代码块包裹", () => {
    expect(parseWordPair('```json\n{"civilianWord":"猫","undercoverWord":"狗"}\n```'))
      .toEqual({ civilianWord: "猫", undercoverWord: "狗" });
  });
  it("两词相同 → null", () => {
    expect(parseWordPair('{"civilianWord":"猫","undercoverWord":"猫"}')).toBeNull();
  });
  it("缺字段 / 非法 → null", () => {
    expect(parseWordPair("not json")).toBeNull();
    expect(parseWordPair('{"civilianWord":"猫"}')).toBeNull();
    expect(parseWordPair('{"civilianWord":"","undercoverWord":"狗"}')).toBeNull();
  });
  it("超长词（>12字符）→ null", () => {
    expect(parseWordPair('{"civilianWord":"这是一个超过十二个字符的超长词","undercoverWord":"狗"}')).toBeNull();
  });
});

describe("pickFallback", () => {
  it("避开 recent 索引", () => {
    const bank: [string, string][] = [["a", "b"], ["c", "d"], ["e", "f"]];
    const r = pickFallback(bank, [0, 1], () => 0); // 只剩索引2可选
    expect(r.index).toBe(2);
    expect(r.civilianWord).toBe("e");
  });
  it("recent 占满时退化为全集随机", () => {
    const bank: [string, string][] = [["a", "b"]];
    expect(pickFallback(bank, [0], () => 0).index).toBe(0);
  });
});
