# CLAUDE.md

本文件为 Claude Code（及其他 AI 助手）提供本项目的架构与约定说明。

## 项目概述

**魔物娘娼馆经营模拟器** —— 基于 AI 大语言模型的成人向（18+）文字经营游戏。玩家扮演馆主，招募/培养魔物娘、接待客人，由 LLM 驱动沉浸式色情叙事。纯前端 + 轻量 API 代理，无后端数据库，存档存于浏览器 `localStorage`。

> 项目最初由 [v0](https://v0.app) 生成，仍保留 v0 工作流痕迹（见 `.gitignore` 中的 `__v0_*` 文件）。

## 技术栈

- **框架**：Next.js 16（App Router）+ React 19
- **语言**：TypeScript 5.7（注意：`next.config.mjs` 中 `ignoreBuildErrors: true`，构建不做类型检查）
- **UI**：Tailwind CSS v4 + shadcn/ui + Radix UI + lucide-react 图标
- **AI 对话**：OpenAI 兼容 API（默认 gpt4novel / Nalang 系列，另支持 xAI Grok）
- **生图**：PixAI / TensorArt（二选一）
- **状态**：React `useState` + `localStorage`，无全局状态库
- **包管理**：pnpm

## 命令

```bash
pnpm dev      # 开发服务器 localhost:3000
pnpm build    # 生产构建（类型错误被忽略）
pnpm start    # 启动生产构建
pnpm lint     # ⚠️ 脚本存在但缺少 ESLint 配置文件
```

环境变量（`.env.local`，均为服务端注入，留空则要求用户在游戏内设置里手填）：
`CHAT_API_KEY`、`GROK_API_KEY`、`PIXAI_API_KEY`、`TENSORART_API_KEY`

## 目录结构

```
app/
  page.tsx              # 入口：有存档→/game，无→显示开始/导入
  setup/page.tsx        # 新游戏向导（馆主信息 → 初始魔物娘）
  game/page.tsx         # 游戏主容器：tab 切换 hub/service/training/market + 设置抽屉
  game/market|service/  # （旧路由占位，实际由 game/page.tsx 内 tab 渲染）
  settings/page.tsx
  api/
    chat/route.ts                 # 对话代理（edge runtime，SSE 流式 + 非流式）
    image/generate/route.ts       # PixAI 提交
    image/task/[taskId]/route.ts  # PixAI 轮询
    image/tensorart/route.ts      # TensorArt 提交
    image/tensorart/[jobId]/route.ts # TensorArt 轮询
    models/route.ts               # 代理 DZMM/gpt4novel v2 模型列表（edge，动态模型）
components/
  daily-hub.tsx         # 每日 Hub 主界面（开场白、动作按钮、魔物娘抽屉、闲聊）
  service-screen.tsx    # 服务/调教场景主界面（最大组件 ~900 行）
  market-screen.tsx     # 奴隶市场（AI 批量生成 + 预设角色购买）
  chat-engine.tsx       # 流式对话引擎（SSE 解析、60s 超时、中止）
  interaction-panel.tsx # 魔物娘日常互动（chat/gift/outfit）
  girl-creator/-card/-templates.tsx, guest-card.tsx, image-display.tsx,
  suggestion-bar.tsx, stat-bar.tsx, settings-panel.tsx, player-setup.tsx
  ui/                   # shadcn/ui 组件（大量未使用）
lib/
  types.ts          # 全局类型 + 模型/风格/设置常量
  game-data.ts      # 种族、特性、技能、预设角色模板、客人池数据
  game-engine.ts    # STATS/ACTIONS 解析、数值计算、会话初始化（纯函数）
  prompt-builder.ts # 所有 System Prompt 构建逻辑（~555 行）
  image-service.ts  # 生图统一入口 + 轮询 + 通过 chat 生成 tag
  image-prompts.ts  # 生图共享常量（IMAGE_NEGATIVE_PROMPT / 质量前缀，PixAI+TensorArt 共用）
  sse.ts            # SSE 流式解析（streamChatDeltas）+ 非流式 parseSseToContent
  storage.ts        # localStorage 读写（存档/设置/存档槽/客人/缓存）
  utils.ts          # cn() 等
hooks/, public/presets/  # 预设角色立绘
```

## 核心数据模型（`lib/types.ts`）

- **`GameSave`**：`{ player, girls[], currentDay, phase, activeSession? }` —— 单一存档对象，存于 `localStorage['game_save']`。
- **`Player`**：name、traits、fetishes、gold、day、guest/marketPreference。
- **`MonstGirl`**：核心三维数值 `affection`/`obedience`/`lewdness`（好感/服从/淫乱，0–100）、外貌/性格/服装的「描述文本 + 英文生图 tags」双字段、`sexualDesc`（性癖设定）、`skills[]`、`imageTags`/`imageUrl`。
- **`Guest`**：客人，含 `satisfaction` 和 `memories`（按魔物娘名字索引的双向关系记忆）。
- **`ServiceSession`**：一次服务/调教会话，含参与魔物娘、消息历史、每个参与者的 `ParticipantStats`（`pleasure`/`stamina`/`isExhausted`，**仅会话内有效，不跨天保留**）。

## 关键数据流

### 1. 对话循环（service / training / hub 闲聊）
```
组件构建 systemPrompt (prompt-builder)
  → ChatEngine.sendMessage / 直接 fetch('/api/chat')
  → api/chat 透传到上游 LLM（Grok 或 gpt4novel）
  → SSE 流式返回 → chat-engine 增量解析渲染
  → 回复末尾含隐藏块 <!--STATS:...--> 和 <!--ACTIONS:...-->
  → game-engine.parseStatsFromReply / parseActionsFromReply 提取
  → 更新数值 → onSaveChange → storage.saveGameSave
```

- `api/chat` 始终向上游请求 `stream:true`；非流式调用方（如生成 tag、开场白）由 `parseSseToContent` 把整段 SSE 拼成一个字符串返回 `{ content }`。
- **模型路由**：`model` 以 `grok` 开头 → 走 xAI 端点用 `grokApiKey`；否则走 gpt4novel 用 `chatApiKey`。客户端未传 key 时回退到服务端环境变量。

### 2. 隐藏数据块协议（叙事↔数值闭环，核心机制）
LLM 在叙事正文后追加两行 HTML 注释，玩家不可见：
- `<!--STATS:{"girls":{"名字":{"pleasure":N,"stamina":N}},"satisfaction":N}-->`
  解析时按角色名匹配，并 **clamp 到合法范围**（pleasure -10..20，stamina -20..-2，satisfaction -5..15）。兼容旧单块格式（`__shared__`）。
- `<!--ACTIONS:["行动1","行动2","行动3"]-->` 三条推荐行动（玩家主动/双方互动/魔物娘主动）。
- 解析失败时 `estimateStatDelta` 用关键词启发式兜底。正则见 `game-engine.ts` 顶部，**对空格/多余字符容错**。
- `STATS_INSTRUCTION` 强制模型用**半角符号**输出 JSON（避免全角 `：｛｝` 导致 `JSON.parse` 失败）；`chat/route.ts` 的 `max_tokens=4096` 是为了给正文 + 这两行结构化尾块都留够空间，避免截断。

### 叙事文风（重油模式）
`AppSettings.proseStyle`（`standard` / `dense`）由设置面板「叙事文风」切换，经 `service-screen` 传入 `buildServiceSystemPrompt`。`prompt-builder.ts` 中：常驻 `PROSE_BAN`（去油黑名单）始终生效，`dense` 额外叠加「重油堆叠」密集感官片段。

### 3. 生图
```
image-service.generateImage(tags, settings)
  → POST /api/image/{generate|tensorart}（提交，返回 taskId/jobId）
  → 客户端每 2s 轮询 /api/image/task/[id]，最多 30 次
  → 成功返回 url，缓存进 girl.imageUrl
```
预设角色使用 `public/presets/` 本地图片，无需生图 API。

## 约定与风格

- 所有用户可见文案为**中文**；生图 tag 为**英文**。
- 注释/分节大量使用 `// ─── 标题 ───` 分隔线，沿用此风格。
- 纯逻辑放 `lib/`（`game-engine.ts` 全为纯函数，易测试），UI 放 `components/`。
- 数值一律 0–100 并在写入时 `Math.max/min` clamp。
- `storage.ts` 读取有 try/catch 容错（脏数据自动清除），**写入目前无异常处理**。
- 组件间通过 props 回调（`onSaveChange` / `onGirlUpdated`）上抛，由 `game/page.tsx` 统一持久化。

## 已知问题 / 注意事项（修改时留意）

- **安全**：`api/*` 路由无鉴权/限流/请求校验，且未传 key 时回退服务端环境变量 —— 公开部署等于把付费 API Key 做成开放代理，勿公网暴露带密钥实例。
- **构建**：`ignoreBuildErrors: true` 会让类型错误直接上线；改动类型后请手动 `tsc --noEmit` 验证。
- **无测试框架**：`game-engine.ts` 的解析逻辑是引入单元测试的最佳起点。
- **游戏性缺口**：天数无机制、无每日支出、体力不跨天、`skills` 系统定义了但从未实际解锁、满意度不 gate 任何内容 —— 扩展玩法时这些是主要切入点。
- **`.idea/` 未加入 `.gitignore`**。
```
