# 魔物娘娼馆经营模拟器

一款基于 AI 大语言模型的成人向魔物娘娼馆经营模拟游戏。玩家扮演馆主，招募、培养魔物娘，接待客人，并通过 AI 驱动的沉浸式文字叙述体验丰富的互动内容。

> **注意：本游戏包含成人向内容，仅限 18 岁以上玩家使用。**

本项目由 [v0](https://v0.app) 构建，点击下方链接可在 v0 中继续开发：

[在 v0 中继续开发 →](https://v0.app/chat/projects/prj_4gOmEZIhSq8QdKx9iYR5C5aJ8lnd)

<a href="https://v0.app/chat/api/kiro/clone/kirby1350/web_based_monmusu_brothel_simulator-5t" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>

---

## 功能特性

### 经营系统
- **大厅管理**：查看所有魔物娘的状态、好感度、服从度、淫乱度与技能
- **奴隶市场**：通过 AI 一次批量生成 3 名待购魔物娘，使用流式传输避免超时
- **金币系统**：通过服务与调教获取收益，支付市场购买费用
- **多存档槽**：支持 3 个独立存档，浏览器本地持久化

### 角色系统
- **预设角色**：内置 5 名高质量预设角色（千雪、娜露梅亚、露埃拉、文香、志希），含完整立绘
- **17 种种族**：猫娘、拉米亚、龙娘、吸血鬼、牛娘等，AI 辅助生成完整角色设定
- **成长培养**：通过调教提升服从度、淫乱度，解锁新侍奉技能

### AI 对话系统
- **服务场景**：沉浸式第三人称叙述，300-500 字/回，含客人行为锚点、快感分级反应系统
- **调教场景**：服从度 × 快感 × 淫乱度三维联动，全套调教语气分级规则
- **互动聊天**：日常好感互动对话
- **推荐行动**：每次 AI 回复自动生成 3 条推荐行动（玩家主动 / 双方互动 / 魔物娘主动）
- **流式传输**：全场景 SSE 流式输出，含 60 秒自动超时与手动中止按钮

### 数值系统
- AI 回复末尾附带隐藏 `<!--STATS:...-->` 数据块，自动解析并更新角色快感、体力、客人满意度
- `<!--ACTIONS:...-->` 数据块自动提取推荐行动，兼容 AI 输出的多种空格格式变体

### 生图系统
- 支持 **PixAI** 与 **TensorArt** 两种生图服务
- 服务端环境变量注入 API Key，无需用户手动填写
- 预设角色使用本地图片，无需生图 API 即可正常显示

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui + Radix UI |
| AI 对话 | OpenAI 兼容 API（支持 Grok / 其他兼容端点） |
| 生图 | PixAI API / TensorArt API |
| 状态管理 | React useState + localStorage 存档 |
| 语言 | TypeScript 5.7 |

---

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd <repo-dir>
pnpm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```env
# 对话模型 API Key（OpenAI 兼容格式）
CHAT_API_KEY=your_chat_api_key

# xAI Grok API Key（使用 Grok 模型时）
GROK_API_KEY=your_grok_api_key

# 生图服务 API Key（二选一或都填）
PIXAI_API_KEY=your_pixai_api_key
TENSORART_API_KEY=your_tensorart_api_key
```

### 3. 启动开发服务器

```bash
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可游玩。

---

## 游戏内设置

进入游戏后点击右上角设置图标，可在界面内直接配置：

| 设置项 | 说明 |
|--------|------|
| 对话模型 | 模型名称，如 `grok-3-mini`、`gpt-4o` |
| API Base URL | 自定义 OpenAI 兼容端点地址 |
| Chat API Key | 留空则自动使用服务端环境变量 |
| Grok API Key | 使用 Grok 系列模型时填写 |
| 生图服务商 | PixAI 或 TensorArt |
| 生图 API Key | 留空则自动使用服务端环境变量 |
| 图片风格 | 选择生图的画风预设 |

---

## 项目结构

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # 对话 API（流式 SSE）
│   │   └── image/generate/        # 生图 API
│   └── game/                      # 游戏页面路由
├── components/
│   ├── service-screen.tsx         # 服务 / 调教场景主界面
│   ├── market-screen.tsx          # 奴隶市场
│   ├── chat-engine.tsx            # 流式对话引擎（含超时机制）
│   ├── image-display.tsx          # 角色立绘显示组件
│   ├── suggestion-bar.tsx         # 推荐行动栏
│   └── ...
├── lib/
│   ├── prompt-builder.ts          # 所有 System Prompt 构建逻辑
│   ├── game-engine.ts             # STATS/ACTIONS 解析、数值计算
│   ├── game-data.ts               # 预设角色、种族、技能数据
│   └── types.ts                   # 全局类型定义
└── public/
    └── presets/                   # 预设角色立绘图片
```

---

## 存档说明

游戏数据存储在浏览器 `localStorage` 中，支持 3 个独立存档槽。清除浏览器数据会导致存档丢失，建议定期备份。

---

## 免责声明

- 本项目仅供个人学习与娱乐使用，请勿用于任何商业目的
- AI 生成内容受所用模型的内容政策限制，部分模型可能拒绝生成特定内容
- 生图功能需要有效的第三方 API Key，产生的调用费用由使用者自行承担
- 本项目中涉及的角色设定均为二次创作，与任何原作版权方无关
