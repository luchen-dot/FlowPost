# FlowPost — 内容生产流水线工具

本地 Web App，一站式内容生产工作流：**选题 → Brief → AI 生成 → 编辑 → 卡片预览 → 导出 PNG**

以小红书图文为主，预留多平台扩展（公众号 / 即刻 / Twitter）。

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

> 首次安装会自动下载 Chromium（~170MB），用于 PNG 导出。

### 2. 初始化数据库

```bash
npm run db:init
```

### 3. 启动应用

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

### 4. 配置 AI

打开 **Settings** 页，填入至少一个 AI Provider 的 API Key（推荐 Claude）。

---

## 核心功能（Phase 1）

| 步骤 | 功能 |
|------|------|
| 📥 Topic Hub | 创建和管理选题（看板视图） |
| 📋 Brief | 填写创作方向：平台、读者、核心信息 |
| ✦ AI 生成 | 流式生成：3个标题候选 + 分段正文 |
| ✍️ 编辑 | 富文本编辑器（Tiptap），支持 AI 润色/重写 |
| 🎨 排版 | 所见即所得卡片样式编辑 |
| 📤 导出 | 单张/全部导出为 PNG（puppeteer 截图） |

---

## 技术栈

- **前端**：React 18 + Vite + Tailwind CSS v4 + Zustand
- **后端**：Node.js + Express
- **数据库**：SQLite + better-sqlite3（本地文件 `data/flowpost.db`）
- **编辑器**：Tiptap v2
- **导出**：Puppeteer（Chromium 截图）
- **AI**：Claude / OpenAI / Gemini / DeepSeek（可配置）

---

## 项目结构

```
src/
├── client/                  # React 前端
│   ├── pages/
│   │   ├── TopicHub.jsx     # 选题中心
│   │   ├── Pipeline.jsx     # 创作流水线（5 步）
│   │   ├── KnowledgeBase.jsx # Phase 2 占位
│   │   └── Settings.jsx     # AI 配置
│   ├── components/
│   │   ├── Layout.jsx       # 导航布局
│   │   ├── CardPreview.jsx  # 卡片预览
│   │   ├── CardEditor.jsx   # 样式编辑器
│   │   └── AIPanel.jsx      # AI 润色/重写面板
│   └── store/
│       └── appStore.js      # Zustand 状态
└── server/
    ├── index.js             # Express 入口（port 3001）
    ├── routes/
    │   ├── topics.js        # 选题 CRUD
    │   ├── posts.js         # 草稿 CRUD + 版本历史
    │   ├── ai.js            # AI 生成（SSE 流式）
    │   ├── export.js        # PNG 导出
    │   └── settings.js      # AI Provider 配置
    ├── services/
    │   └── aiProvider.js    # 多 Provider 调度
    └── db/
        ├── schema.sql       # 数据库结构
        └── database.js      # SQLite 连接
```

---

## 可用命令

```bash
npm run dev        # 同时启动前端和后端（开发模式）
npm run server     # 仅启动后端
npm run build      # 构建前端
npm run db:init    # 初始化数据库
```

---

## 数据安全

- 所有数据存储在本地 `data/flowpost.db`，备份即复制文件
- API Key 存储在本地 SQLite，不经过任何外部服务器
- 导出临时文件存放在 `temp/`，可定期清理

---

## 路线图

- **Phase 1**（当前）：核心流水线 MVP
- **Phase 2**：知识库（Notion 同步 + 向量检索 + 选题挖掘）
- **Phase 3**：选题中心完善（RSS / GitHub Trending / 爆款克隆）
- **Phase 4**：体验完善（模板系统 / 版本历史 / 多 Provider 切换）

---

*PRD Version: 2.0 | Phase 1 MVP | 本地单用户使用*
