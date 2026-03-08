"""
AI Analyzer module using Claude API.
Analyzes tasks, determines priorities, and provides actionable suggestions.
"""
import json
import datetime
from typing import Optional

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from config.settings import AI_MODEL, AI_MAX_TOKENS


ANALYSIS_PROMPT_ZH = """你是一个专业的个人效率助手。今天是 {today}，{weekday}。

以下是用户今天的所有待办事项，来自不同来源：

## Google Calendar 日程
{calendar_section}

## Google Tasks 任务
{tasks_section}

## AI对话中创建的工作事项
{ai_tasks_section}

请你完成以下分析：

1. **优先级排序**：综合考虑紧急程度（截止时间、会议时间）、重要程度（标签/关键字暗示的重要性）、工作量，为所有任务按优先级排序（P1最高 - P4最低）。

2. **时间规划建议**：根据日历日程和任务量，给出今天的时间分配建议（比如哪个时间段专注处理哪类工作）。

3. **执行建议**：针对优先级最高的3-5项任务，给出具体的执行建议（如何开始、注意事项、预估时长）。

4. **风险提示**：识别今天可能的瓶颈或冲突（如会议太多导致无深度工作时间、临近截止的任务等）。

5. **今日一句激励**：给一句简短有力的激励语。

请用清晰的中文回复，使用Markdown格式，让内容层次分明、易于阅读。"""


ANALYSIS_PROMPT_EN = """You are a professional personal productivity assistant. Today is {today}, {weekday}.

Here are all the user's tasks for today from different sources:

## Google Calendar Events
{calendar_section}

## Google Tasks
{tasks_section}

## AI Conversation Work Items
{ai_tasks_section}

Please complete the following analysis:

1. **Priority Ranking**: Considering urgency (deadlines, meeting times), importance (implied by labels/keywords), and workload, rank all tasks by priority (P1 highest - P4 lowest).

2. **Time Planning**: Based on calendar events and task volume, suggest how to allocate time today.

3. **Execution Suggestions**: For the top 3-5 priority tasks, provide specific execution advice (how to start, key considerations, estimated duration).

4. **Risk Alerts**: Identify potential bottlenecks or conflicts today (e.g., too many meetings leaving no deep work time, approaching deadlines).

5. **Daily Motivation**: One short, powerful motivational sentence.

Please respond in clear English using Markdown format for readability."""


def _format_calendar_events(events: list[dict]) -> str:
    if not events:
        return "（今日无日程）"
    lines = []
    for e in events:
        start = e.get("start", "")
        # Show only time portion if datetime, or full date if all-day
        if "T" in start:
            try:
                dt = datetime.datetime.fromisoformat(start.replace("Z", "+00:00"))
                start_fmt = dt.strftime("%H:%M")
            except ValueError:
                start_fmt = start
        else:
            start_fmt = start + " (全天)"
        desc = e.get("description", "").strip()
        loc = e.get("location", "").strip()
        line = f"- [{start_fmt}] **{e['title']}**"
        if loc:
            line += f" @ {loc}"
        if desc:
            line += f"\n  备注: {desc[:100]}"
        lines.append(line)
    return "\n".join(lines)


def _format_google_tasks(tasks: list[dict]) -> str:
    if not tasks:
        return "（无待完成任务）"
    lines = []
    for t in tasks:
        due = t.get("due_date", "")
        due_label = f" [截止: {due}]" if due else " [无截止日期]"
        notes = t.get("notes", "").strip()
        tl = t.get("task_list", "")
        line = f"- **{t['title']}**{due_label} (清单: {tl})"
        if notes:
            line += f"\n  备注: {notes[:100]}"
        lines.append(line)
    return "\n".join(lines)


def _format_ai_tasks(ai_tasks: list[dict]) -> str:
    if not ai_tasks:
        return "（无AI对话工作事项）"
    lines = []
    for t in ai_tasks:
        created = t.get("created_at", "")[:10] if t.get("created_at") else ""
        priority_hint = f" [初始优先级: {t['priority']}]" if t.get("priority") else ""
        status = t.get("status", "pending")
        status_zh = {"pending": "待处理", "in_progress": "进行中", "done": "已完成"}.get(status, status)
        line = f"- **{t['title']}**{priority_hint} [状态: {status_zh}]"
        if created:
            line += f" [创建于: {created}]"
        if t.get("description"):
            line += f"\n  详情: {t['description'][:150]}"
        lines.append(line)
    return "\n".join(lines)


def analyze_tasks(
    calendar_events: list[dict],
    google_tasks: list[dict],
    ai_tasks: list[dict],
    api_key: str,
    language: str = "zh",
) -> dict:
    """
    Use Claude API to analyze all tasks and return structured analysis.

    Returns:
        {
            "success": bool,
            "analysis": str,          # Full markdown analysis
            "prioritized_tasks": [...],# Ordered task list with priority labels
            "error": str | None
        }
    """
    if not ANTHROPIC_AVAILABLE:
        return {
            "success": False,
            "analysis": "",
            "prioritized_tasks": [],
            "error": "anthropic 库未安装，请运行: pip install anthropic",
        }

    if not api_key:
        return {
            "success": False,
            "analysis": "",
            "prioritized_tasks": [],
            "error": "未配置 Anthropic API Key，请在设置中填写。",
        }

    today = datetime.date.today()
    weekdays_zh = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekdays_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday = weekdays_zh[today.weekday()] if language == "zh" else weekdays_en[today.weekday()]
    today_str = today.strftime("%Y年%m月%d日") if language == "zh" else today.strftime("%B %d, %Y")

    cal_section = _format_calendar_events(calendar_events)
    tasks_section = _format_google_tasks(google_tasks)
    ai_section = _format_ai_tasks(ai_tasks)

    prompt_template = ANALYSIS_PROMPT_ZH if language == "zh" else ANALYSIS_PROMPT_EN
    user_message = prompt_template.format(
        today=today_str,
        weekday=weekday,
        calendar_section=cal_section,
        tasks_section=tasks_section,
        ai_tasks_section=ai_section,
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=AI_MAX_TOKENS,
            system=(
                "你是一个专业、务实的个人效率助手，擅长任务优先级分析和时间管理。"
                "回复简洁有力，直接给出可执行的建议。"
                if language == "zh"
                else "You are a professional, pragmatic personal productivity assistant skilled in task prioritization and time management. Be concise and actionable."
            ),
            messages=[{"role": "user", "content": user_message}],
        )
        analysis_text = message.content[0].text

        # Build a simple prioritized task list by combining all sources
        all_items = []
        for e in calendar_events:
            all_items.append({"source": "calendar", "title": e["title"], "type": "event", "time": e.get("start", "")})
        for t in google_tasks:
            all_items.append({"source": "google_tasks", "title": t["title"], "type": "task", "due": t.get("due_date", "")})
        for t in ai_tasks:
            if t.get("status") != "done":
                all_items.append({"source": "ai_conversation", "title": t["title"], "type": "work_item", "priority_hint": t.get("priority", "")})

        return {
            "success": True,
            "analysis": analysis_text,
            "prioritized_tasks": all_items,
            "error": None,
            "token_usage": {
                "input": message.usage.input_tokens,
                "output": message.usage.output_tokens,
            },
        }

    except Exception as e:
        return {
            "success": False,
            "analysis": "",
            "prioritized_tasks": [],
            "error": f"AI 分析失败: {str(e)}",
        }
