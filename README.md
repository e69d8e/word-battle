# Word Battle 单词大作战 ⚔️

一个专为英语学习者打造的高节奏、多端支持的单词竞技 PK 平台。涵盖 CET-4、CET-6、TOEFL、IELTS 四大核心词库，支持人机对练与基于 Supabase Realtime 的毫秒级真人双人实时同屏对决。

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?logo=supabase)
![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron)

---

## 目录

- [核心特性](#-核心特性)
- [游戏与计分机制](#-游戏与计分机制)
- [系统架构与时序](#-系统架构与时序)
- [技术栈清单](#-技术栈清单)
- [数据模型](#-数据模型)
- [API 接口清单](#-api-接口清单)
- [环境搭建与本地运行](#-环境搭建与本地运行)
- [构建与多端部署](#-构建与多端部署)

---

## 🌟 核心特性

### 1. 多样化对战模式
- **🤖 人机对战**：内置具备动态响应延迟与 ~70% 真实准确率的智能 AI 对手，适合日常速练与碎片时间自测。
- **⚡ 实时在线对决**：基于 Supabase Realtime 广播频道，支持 6 位专属房间码一键创建/加入，毫秒级同步对手作答状态、连击与得分。
- **🔄 一键无缝重赛**：对局结束后支持双方一键申请 Rematch，由房主自动生成全新题库无缝开战。

### 2. 多维题型与词库覆盖
- **英译中**：看英文选正确中文释义。
- **中译英**：看中文快速识别英文单词。
- **听音选词**：原生标准美式发音实时播放，听音辨义。
- **词库体系**：
  | 词库级别 | 适用人群 / 考试 | 词汇量 |
  | :--- | :--- | :--- |
  | **CET-4** | 大学英语四级考试 | 4,500+ |
  | **CET-6** | 大学英语六级考试 | 6,500+ |
  | **TOEFL** | 托福出国留学考试 | 8,000+ |
  | **IELTS** | 雅思学术/移民类考试 | 5,000+ |

### 3. 极速操作与交互体验
- **全键盘快捷键**：支持 `A` / `B` / `C` / `D` 或 `1` / `2` / `3` / `4` 盲打击键选词，`Space` 触发标准读音朗读。
- **原生音效引擎**：基于 Web Audio API 实现纯合成音效（倒计时、连击音阶爬升、胜负专属旋律），支持全局一键静音。
- **错题复习本**：结算页支持「全部 / 仅错题 / 答对」多维筛选，单词音标、释义、例句与标准发音随选随听。
- **生涯战报与段位**：自动统计生涯场次、胜率、历史最高分，评估王者/大师/新星段位；支持一键复制对局战报文本。
- **天梯名人堂**：支持分词库排行榜筛选与 Top-3 领奖台视觉呈现。

---

## 🎯 游戏与计分机制

每局标准对战为 **10 道随机题目**，每题答题限时 **15 秒**。

### 计分公式
$$\text{单题总分} = \text{基础分} + \text{速度奖励分} + \text{连击加成分}$$

- **基础得分（Base Score）**：答对得 **100 分**，答错得 **0 分**。
- **速度奖励（Time Bonus）**：$$\text{Bonus} = \max\left(0, \left\lfloor \frac{15000 - \text{答题耗时(ms)}}{100} \right\rfloor\right)$$（最高可得 **50 分**）。
- **连击加成（Combo Bonus）**：
  - 连续答对第 2 题起触发连击奖励：$$\text{Combo Bonus} = \min\left(50, (\text{当前连击数} - 1) \times 10\right)$$（最高可得 **50 分**）。
  - 答错或超时将立即中断连击，连击数重置为 **0**。
- **单题满分**：最高 **200 分**；单局 10 题理论巅峰得分为 **2,279+ 分**。

---

## 🏗 系统架构与时序

### 实时对战时序图

```mermaid
sequenceDiagram
    autonumber
    actor A as 玩家 A (Host)
    participant S as Supabase Realtime (room:CODE)
    actor B as 玩家 B (Joiner)

    Note over A,B: 房间就绪阶段
    A->>S: createRoom & broadcast("room-update")
    B->>S: joinRoom & broadcast("request-state")
    A->>S: broadcast("room-update", { players: [A, B] })
    A->>S: broadcast("game-started", { questions, totalQuestions })
    S-->>B: 同步题库并进入对战页

    Note over A,B: 答题与实时同步阶段
    A->>A: 本地提交答题 (计算 score1, combo1)
    A->>S: broadcast("answer-submitted", { totalScore, combo, maxCombo, lastScoreGained, isCorrect })
    S-->>B: syncOpponentAnswer (更新 score2, combo2, 触发浮动得分与🔥动画)

    Note over A,B: 终态结算阶段
    A->>S: broadcast("player-finished", { finalScore, maxCombo, answers })
    B->>S: broadcast("player-finished", { finalScore, maxCombo, answers })
    Note over A,B: 双方终态数据校验无误后调用 finishGame() 并保存战报至 DB
```

---

## 💻 技术栈清单

| 领域 / 层级 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **应用框架** | Next.js 16.2.6 (App Router) | 全 Client Components 架构，支持 React 19 新特性 |
| **编程语言** | TypeScript 5.x (Strict) | 严谨的前后端类型约束 |
| **样式系统** | Tailwind CSS v4 + PostCSS | 定制化主题色板、响应式断点与流畅微动画 |
| **状态管理** | Zustand | 轻量级高性能游戏状态机 (`gameStore`) 与鉴权状态 (`authStore`) |
| **数据库** | PostgreSQL (Supabase) + Prisma 6 | ORM 数据持久化与高并发连接池支持 |
| **实时通信** | Supabase Realtime | WebSocket 广播与 Presence 房间监听通道 |
| **音频引擎** | Web Audio API + Web Speech API | 零第三方依赖合成音效 + 浏览器原声朗读 fallback |
| **桌面客户端** | Electron 42 + Electron Builder | 支持跨平台桌面端独立打包 |
| **部署托管** | Netlify (`@netlify/plugin-nextjs`) | 自动化 CI/CD 与 Edge 网络分发 |

---

## 🗄 数据模型

```mermaid
erDiagram
    User ||--o{ Game : "player1 / player2"
    User ||--o{ Score : "records"
    WordList ||--o{ Word : "contains"
    Word ||--o{ GameQuestion : "references"
    Game ||--o{ GameQuestion : "has"

    User {
        string id PK
        string username UK
        string password
        string avatar
        datetime createdAt
    }

    WordList {
        string id PK
        string name
        string level
    }

    Word {
        string id PK
        string word
        string phonetic
        string meaning
        string meaningCn
        string example
        string listId FK
    }

    Game {
        string id PK
        string mode
        string status
        string wordLevel
        string player1Id FK
        string player2Id FK
        string winnerId FK
        int score1
        int score2
        int totalQ
        datetime finishedAt
        datetime createdAt
    }

    GameQuestion {
        string id PK
        string gameId FK
        string wordId FK
        string type
        string options
        string answer1
        string answer2
        boolean correct1
        boolean correct2
        int time1
        int time2
    }

    Score {
        string id PK
        string userId FK
        string mode
        string level
        int score
        datetime createdAt
    }
```

---

## 🔌 API 接口清单

| 请求方法 | 路由路径 | 参数 / Body | 功能描述 |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `{ username, password }` | 用户注册（bcrypt 加密存储） |
| `POST` | `/api/auth/login` | `{ username, password }` | 用户登录与凭证验证 |
| `GET` | `/api/auth/me` | Query: `?userId=...` | 获取当前用户信息 |
| `GET` | `/api/words` | Query: `?level=CET4` | 获取指定等级单词库（首次请求自动从本地 JSON 种子入库） |
| `POST` | `/api/game` | `{ mode, wordLevel, player1Id, score1, score2, questions }` | 保存游戏对局记录及天梯积分 |
| `GET` | `/api/game` | Query: `?userId=...&mode=...&limit=20` | 查询用户历史对战记录 |
| `GET` | `/api/leaderboard`| Query: `?mode=...&level=CET4&limit=50` | 获取全球天梯排行榜 |

---

## 🚀 环境搭建与本地运行

### 1. 环境准备
- Node.js 18.18+ 或 Node.js 20+
- PostgreSQL 数据库（推荐直接使用 [Supabase](https://supabase.com)）

### 2. 本地安装

```bash
# 1. 克隆代码仓库
git clone https://github.com/e69d8e/word-battle.git
cd word-battle

# 2. 安装项目依赖
npm install

# 3. 配置环境变量
cp .env.example .env
```

### 3. 配置 `.env`

```env
# Supabase PostgreSQL 连接串
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Supabase Realtime 客户端凭证
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### 4. 初始化数据库

```bash
# 生成 Prisma Client
npm run prisma:generate

# 应用数据库迁移
npm run prisma:migrate

# （可选）手动灌入初始单词数据
npm run db:seed
```

### 5. 启动服务

```bash
# 启动 Web 开发服务器 (localhost:3000)
npm run dev

# 或启动 Electron 桌面端开发环境
npm run electron-dev
```

---

## 📦 构建与多端部署

### Web 生产构建

```bash
npm run build
npm start
```

### 桌面端打包 (Electron)

```bash
npm run electron-build
```

### 自动化部署 (Netlify)
仓库已集成 `netlify.toml`，绑定 GitHub 仓库后即可实现自动化流水线构建：
- 构建指令：`node scripts/download-audio.js && npm run build`
- 发布目录：`.next`
- 插件配置：`@netlify/plugin-nextjs`

---

## 📄 License

本项目基于 [MIT License](LICENSE) 开源。
