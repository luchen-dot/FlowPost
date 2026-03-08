# Daily Task Reminder — 配置指南

## 功能概述

每日自动整合以下来源的待办事项，通过 AI 分析优先级并推送桌面通知：

| 来源 | 说明 |
|------|------|
| **Google Calendar** | 当日日程事件 |
| **Google Tasks** | 未完成的任务（今日到期或无截止日期）|
| **AI 对话工作事项** | 在 App 中手动录入的工作事项（记录 AI 对话产生的任务）|

AI 将综合三个来源，给出：
- 优先级排序（P1–P4）
- 时间规划建议
- 每项高优先级任务的执行建议
- 风险提示（如日程冲突、深度工作时间不足等）
- 每日激励语

---

## 安装步骤

### 1. 安装 Python 依赖

```bash
cd daily_reminder
pip install -r requirements.txt
```

### 2. 配置 Google API（获取 credentials.json）

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目（或选择现有项目）
3. 启用以下 API：
   - **Google Calendar API**
   - **Google Tasks API**
4. 创建 OAuth 2.0 凭据（类型选"桌面应用"）
5. 下载 JSON 文件，重命名为 `credentials.json`，放至 `daily_reminder/config/` 目录

### 3. 配置 Anthropic API Key

方式一：环境变量（推荐）
```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
```

方式二：在应用设置界面填写（菜单 → 文件 → 设置）

### 4. 首次运行（授权 Google 账号）

```bash
cd daily_reminder
python main.py
```

首次运行时会弹出浏览器窗口，授权 Google 账号。授权成功后 token 自动保存至 `data/token.json`，后续无需重复操作。

---

## 使用方式

### 启动 GUI 应用

```bash
python main.py
```

- **今日汇总**标签：查看当日 Google Calendar 日程和 Tasks
- **AI分析建议**标签：查看 AI 对三个来源任务的综合分析
- **AI工作事项**标签：管理从 AI 对话中整理的工作事项

### 定时推送

在设置中配置推送时间（默认 **08:00**），应用运行期间会在指定时间自动：
1. 拉取最新 Google Calendar / Tasks 数据
2. 调用 Claude API 进行分析
3. 发送桌面通知（包含任务摘要和 AI 建议片段）
4. 更新 GUI 界面

### 立即推送

点击工具栏「🔄 立即推送」按钮，可随时触发一次完整的拉取 + 分析 + 通知流程。

### 无界面（Headless）模式（适用于 cron）

```bash
python main.py --trigger-now
```

适合配置系统定时任务（Linux cron / macOS launchd / Windows Task Scheduler）：

**Linux / macOS cron（每天早 8 点）：**
```
0 8 * * * cd /path/to/daily_reminder && /usr/bin/python3 main.py --trigger-now
```

### CLI 添加工作事项

```bash
python main.py --add-task
```

---

## 目录结构

```
daily_reminder/
├── main.py                    # 程序入口
├── requirements.txt           # Python 依赖
├── setup_guide.md             # 本文档
├── config/
│   ├── settings.py            # 全局配置
│   └── credentials.json       # Google OAuth2 凭据（需自行下载放入）
├── modules/
│   ├── google_services.py     # Google Calendar & Tasks API
│   ├── ai_analyzer.py         # Claude AI 分析模块
│   ├── task_storage.py        # AI 工作事项本地存储（JSON）
│   ├── notifier.py            # 桌面通知模块
│   ├── scheduler.py           # 定时调度 + 任务流程编排
│   └── gui.py                 # tkinter GUI + 系统托盘
├── assets/
│   └── icon.png               # 应用图标（可自定义替换）
└── data/                      # 运行时数据（自动创建）
    ├── token.json             # Google OAuth token
    ├── tasks.json             # AI 工作事项数据库
    └── user_settings.json     # 用户设置
```

---

## 常见问题

**Q: 系统托盘图标不显示？**
A: 确保已安装 `pystray` 和 `Pillow`：`pip install pystray Pillow`

**Q: Linux 桌面通知不显示？**
A: 确保已安装 `libnotify`：`sudo apt install libnotify-bin`（Ubuntu/Debian）

**Q: Google API 授权失败？**
A: 检查 `credentials.json` 是否放在正确位置，OAuth 类型是否为"桌面应用"。

**Q: AI 分析返回错误？**
A: 检查 API Key 是否正确配置，网络是否可访问 Anthropic API。
