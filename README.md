# Word Battle 单词大作战

一个面向中国用户的英语单词 PK 对战平台，支持 CET-4、CET-6、TOEFL、IELTS 词汇学习。玩家可以与 AI 或真人好友进行实时单词对战，在游戏中提升词汇量。

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E)

## 功能特性

### 游戏模式
- **🤖 人机对战** - 与 AI 进行单词 PK，适合单人练习和自测（AI 准确率约 70%）
- **⚡ 实时对战** - 通过 Supabase Realtime 与朋友实时比拼答题速度和正确率
- **📨 异步挑战** - 发起挑战，好友随时应战（即将上线）

### 题型
- **英译中** - 看英文选中文释义
- **中译英** - 看中文选英文单词
- **听音选词** - 听发音选正确单词

### 词汇级别
| 级别 | 描述 | 词汇量 |
|------|------|--------|
| CET-4 | 大学英语四级 | 4500+ |
| CET-6 | 大学英语六级 | 6500+ |
| TOEFL | 托福词汇 | 8000+ |
| IELTS | 雅思词汇 | 5000+ |

### 计分规则
- 基础分：答对一题得 **100 分**
- 时间奖励：每题 15 秒限时，剩余时间转化为额外分数（最高 50 分）
- 答错不得分

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| 类型 | TypeScript (strict mode) |
| 状态管理 | Zustand |
| 数据库 | Supabase PostgreSQL + Prisma ORM |
| 实时通信 | Supabase Realtime |
| 桌面端 | Electron |
| 部署 | Netlify |

## 项目结构

```
src/
├── app/
│   ├── page.tsx                 # 首页（Hero + 功能介绍）
│   ├── layout.tsx               # 根布局：AuthProvider + Header
│   ├── (auth)/
│   │   ├── login/               # 登录页
│   │   └── register/            # 注册页
│   ├── (main)/
│   │   ├── game/                # 游戏主页面（模式选择 + 游戏进行）
│   │   ├── lobby/               # 实时对战大厅（创建/加入房间）
│   │   ├── leaderboard/         # 全球排行榜
│   │   └── history/             # 游戏历史记录
│   └── api/                     # API 路由
│       ├── auth/                # 认证接口（注册/登录/获取用户）
│       ├── game/                # 游戏记录接口
│       ├── words/               # 单词数据接口（自动种子）
│       └── leaderboard/         # 排行榜接口
├── components/
│   ├── game/                    # 游戏组件（QuestionCard, ScoreBoard, Timer, GameResult）
│   ├── layout/                  # 布局组件（Header）
│   ├── providers/               # Context Providers（AuthProvider）
│   └── ui/                      # 通用 UI 组件（Button, Card, Input, Badge, Progress）
├── stores/                      # Zustand 状态管理
│   ├── authStore.ts             # 用户认证状态
│   └── gameStore.ts             # 游戏状态机
├── hooks/                       # 自定义 Hooks
│   ├── useSpeech.ts             # Web Speech API
│   └── useTimer.ts              # 基于 rAF 的计时器
├── lib/                         # 工具库
│   ├── db.ts                    # Prisma 单例
│   ├── supabase.ts              # Supabase 客户端
│   └── utils.ts                 # 工具函数
├── types/                       # TypeScript 类型定义
└── data/words/                  # 词汇数据 JSON 文件
    ├── cet4.json
    ├── cet6.json
    ├── toefl.json
    └── ielts.json
```

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 数据库（推荐使用 Supabase）

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/word-battle.git
cd word-battle

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入数据库连接信息
```

### 环境变量

```bash
# Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Supabase 客户端（用于 Realtime）
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON-KEY]
```

### 数据库设置

```bash
# 生成 Prisma Client
npm run prisma:generate

# 执行数据库迁移
npm run prisma:migrate

# 种子数据（可选，单词数据会在首次请求时自动加载）
npm run db:seed
```

### 开发

```bash
# 启动开发服务器
npm run dev

# 或启动 Electron 桌面端开发
npm run electron-dev
```

访问 http://localhost:3000

### 构建

```bash
# Web 版本构建
npm run build

# Electron 桌面端构建
npm run electron-build
```

## 部署

### Netlify（推荐）

项目已配置 `netlify.toml`，推送到 GitHub 后可直接在 Netlify 部署：

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 手动部署

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/words?level=CET4` | 获取单词列表（自动种子） |
| POST | `/api/game` | 保存游戏记录 |
| GET | `/api/game` | 获取游戏历史 |
| GET | `/api/leaderboard` | 获取排行榜 |

## 实时对战架构

实时对战基于 Supabase Realtime channels 实现：

```
客户端 A                    Supabase Realtime                    客户端 B
    │                           │                                    │
    ├── 创建房间 ──────────────►│                                    │
    │                           │◄─────────────── 加入房间 ──────────┤
    │                           │                                    │
    ├── 提交答案(answer-submitted) ──────────►│                      │
    │                           │◄──── 广播答案给对手 ───────────────┤
    │                           │                                    │
    ├── 完成通知(player-finished) ────────────►│                      │
    │                           │◄──── 广播完成状态 ─────────────────┤
    │                           │                                    │
    └── 游戏结束(game-ended) ──►│◄──── 游戏结束 ────────────────────┘
```

**频道命名**：`room:{roomId}`

**事件类型**：
- `answer-submitted` - 答案提交（包含答案、耗时、正确性、得分）
- `player-finished` - 玩家完成所有题目
- `game-ended` - 游戏结束

## 数据模型

```prisma
User          # 用户（id, username, password, avatar）
WordList      # 词表（name, level）
Word          # 单词（word, phonetic, meaning, meaningCn, example）
Game          # 对局（mode, status, scores, players）
GameQuestion  # 题目（options, answers, correctness, time）
Score         # 成绩（userId, mode, level, score）
```

## 开发命令

```bash
npm run dev              # 开发服务器
npm run build            # 生产构建
npm run lint             # ESLint 检查
npm run prisma:studio    # Prisma Studio 数据库管理
npm run prisma:migrate   # 创建并执行迁移
npm run prisma:generate  # 重新生成 Prisma Client
npm run db:seed          # 种子数据
npm run electron-dev     # Electron 开发模式
npm run electron-build   # Electron 构建
```

## License

MIT

---

**Word Battle** - 让英语单词学习变得有趣！⚔️
