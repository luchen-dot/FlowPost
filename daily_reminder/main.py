"""
Daily Task Reminder — Entry point.

Usage:
    python main.py                  # Launch GUI
    python main.py --trigger-now    # Run once immediately (headless, for cron)
    python main.py --add-task       # CLI task add (interactive)
"""
import sys
import os
import logging
import argparse

# ── Make sure project root is on sys.path ──
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


def _run_headless():
    """Run the daily task pipeline once and exit (suitable for cron / launchd)."""
    from config.settings import load_user_settings
    from modules.scheduler import run_daily_task

    settings = load_user_settings()
    logger.info("=== Daily Task Reminder (headless mode) ===")
    result = run_daily_task(settings)
    if result.get("error"):
        logger.error("Error: %s", result["error"])
        sys.exit(1)
    logger.info(
        "Done. Calendar: %d, Tasks: %d, AI Items: %d",
        len(result.get("calendar", [])),
        len(result.get("tasks", [])),
        len(result.get("ai_tasks", [])),
    )
    logger.info("Notification sent: %s", result.get("notification_sent", False))


def _run_cli_add():
    """Interactive CLI to add an AI conversation work item."""
    from modules.task_storage import add_task

    print("\n=== 添加 AI 工作事项 ===")
    title = input("标题: ").strip()
    if not title:
        print("标题不能为空，已取消")
        return
    description = input("描述 (可留空): ").strip()
    priority = input("优先级 [P1/P2/P3/P4，默认P3]: ").strip().upper() or "P3"
    due_date = input("截止日期 [YYYY-MM-DD，可留空]: ").strip()
    tags_raw = input("标签 [逗号分隔，可留空]: ").strip()
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
    context = input("对话上下文 (可留空): ").strip()

    task = add_task(
        title=title,
        description=description,
        priority=priority,
        tags=tags,
        due_date=due_date,
        source_context=context,
    )
    print(f"\n✅ 已添加任务: [{task['priority']}] {task['title']}  (ID: {task['id'][:8]}…)")


def _run_gui():
    """Launch the tkinter GUI application."""
    try:
        from modules.gui import MainApp
        app = MainApp()
        app.mainloop()
    except ImportError as e:
        logger.error("GUI 依赖缺失: %s", e)
        logger.error("请运行: pip install -r requirements.txt")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Daily Task Reminder — AI-powered task aggregator and notifier"
    )
    parser.add_argument(
        "--trigger-now",
        action="store_true",
        help="Run the daily pipeline once and exit (headless mode for cron/launchd)",
    )
    parser.add_argument(
        "--add-task",
        action="store_true",
        help="Interactively add an AI conversation work item via CLI",
    )
    args = parser.parse_args()

    if args.trigger_now:
        _run_headless()
    elif args.add_task:
        _run_cli_add()
    else:
        _run_gui()


if __name__ == "__main__":
    main()
