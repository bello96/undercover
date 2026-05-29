# 🕵️ 谁是卧底 · 在线多人实时推理游戏

**线上地址**：[https://undercover.dengjiabei.cn](https://undercover.dengjiabei.cn)

3-6 人参与，其中 1 名卧底混入平民之中——通过描述、倾听和投票，找出那个说着不同词的人。

---

## 玩法

1. 房主创建房间，获得 6 位房间号
2. 其他玩家输入房间号加入
3. 房主点击「开始游戏」
4. 系统发词：N-1 名平民获得同一个词，1 名卧底获得相近但不同的词
5. 所有玩家轮流用一句话描述自己的词（不能直说词本身）
6. 描述结束后，所有人投票选出最可疑的玩家
7. 得票最多者出局，揭晓其身份
8. 重复描述→投票，直至卧底出局（平民胜）或卧底人数 ≥ 平民人数（卧底胜）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Twind（Tailwind-in-JS） |
| 后端 | Cloudflare Workers + Durable Objects（WebSocket 状态机） |
| 实时通信 | WebSocket（每个房间一个 DO 实例） |
| AI 发词 | DeepSeek API（失败时自动回退内置词库） |
| 部署 | Cloudflare Pages（前端）+ Cloudflare Workers（后端） |

---

## 本地开发

### 环境准备

```bash
# 克隆仓库后安装前端依赖（项目使用 legacy-peer-deps）
npm install --legacy-peer-deps
```

### 启动前端

```bash
npm run dev
```

默认连接线上 Worker（`https://undercover.dengjiabei.cn/api`）。  
如需本地联调，修改 `.env.local`：

```
VITE_API_BASE=http://localhost:8787
```

### 启动本地 Worker

```bash
cd worker && npx wrangler dev
```

> 本地 Worker 不含 DeepSeek API Key，发词会自动降级到内置词库。

### 运行 Worker 单元测试

```bash
cd worker && npx vitest run
```

---

## 部署

### CI/CD（推荐）

push 到 `main` 分支自动触发：

- `worker/**` 路径有变动 → 触发 **Worker 部署**（`.github/workflows/deploy-worker.yml`）
- 其余路径有变动 → 触发 **Pages 部署**（`.github/workflows/deploy-pages.yml`）

**需在 GitHub 仓库 Settings → Secrets 中配置**：

| Secret 名称 | 说明 |
|-------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需有 Workers & Pages 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

### 首次配置 DeepSeek 发词密钥

DeepSeek API Key 通过 Wrangler Secret 注入 Cloudflare 端，**不进仓库、不进 CI**：

```bash
cd worker && npx wrangler secret put DEEPSEEK_API_KEY
# 按提示粘贴 Key 后回车
```

玩家无需任何配置，开箱即玩。

### 手动部署

```bash
# 部署前端
npm run deploy:pages

# 部署 Worker
npm run deploy:worker
```

---

## 项目文档

- [`DESIGN.md`](./DESIGN.md) — UI 设计规范与组件说明
- [`CLAUDE.md`](./CLAUDE.md) — AI 协作约定
- [`docs/`](./docs/) — 游戏设计 Spec 与实现计划
