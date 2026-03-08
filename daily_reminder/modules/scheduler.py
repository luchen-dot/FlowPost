"""
Scheduler module: runs daily task fetch + AI analysis + notification.
Uses the `schedule` library for lightweight job scheduling.
"""
import threading
import logging
import time
import datetime
from typing import Callable, Optional

try:
    import schedule
    SCHEDULE_AVAILABLE = True
except ImportError:
    SCHEDULE_AVAILABLE = False

from config.settings import load_user_settings

logger = logging.getLogger(__name__)


class DailyScheduler:
    """
    Manages the daily reminder job.

    Usage:
        scheduler = DailyScheduler(on_trigger_callback)
        scheduler.start()
        ...
        scheduler.stop()
    """

    def __init__(self, on_trigger: Callable, settings: Optional[dict] = None):
        """
        Args:
            on_trigger: Callable invoked when the daily job fires.
                        Should accept no arguments.
            settings: Optional preloaded settings dict.
        """
        self._on_trigger = on_trigger
        self._settings = settings or load_user_settings()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._job = None

    # ──────────────────────────────────────────────
    # Public
    # ──────────────────────────────────────────────

    def start(self) -> None:
        """Start the scheduler in a background daemon thread."""
        if not SCHEDULE_AVAILABLE:
            logger.error("schedule 库未安装，请运行: pip install schedule")
            return

        self._stop_event.clear()
        self._schedule_job()

        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="DailySchedulerThread")
        self._thread.start()
        logger.info("定时任务已启动，推送时间: %s", self._settings.get("reminder_time", "08:00"))

    def stop(self) -> None:
        """Signal the scheduler thread to stop."""
        self._stop_event.set()
        if self._job:
            try:
                schedule.cancel_job(self._job)
            except Exception:
                pass
        logger.info("定时任务已停止")

    def update_time(self, new_time: str) -> None:
        """
        Change the daily reminder time (format: HH:MM).
        Takes effect immediately by rescheduling.
        """
        self._settings["reminder_time"] = new_time
        if self._job:
            try:
                schedule.cancel_job(self._job)
            except Exception:
                pass
        self._schedule_job()
        logger.info("推送时间已更新为: %s", new_time)

    def trigger_now(self) -> None:
        """Manually trigger the reminder job immediately (runs in a new thread)."""
        t = threading.Thread(target=self._safe_trigger, daemon=True, name="ManualTrigger")
        t.start()

    # ──────────────────────────────────────────────
    # Private
    # ──────────────────────────────────────────────

    def _schedule_job(self) -> None:
        reminder_time = self._settings.get("reminder_time", "08:00")
        self._job = schedule.every().day.at(reminder_time).do(self._safe_trigger)

    def _safe_trigger(self) -> None:
        try:
            logger.info("触发每日任务推送 [%s]", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            self._on_trigger()
        except Exception as e:
            logger.exception("每日任务推送异常: %s", e)

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            schedule.run_pending()
            time.sleep(30)  # check every 30 seconds


# ──────────────────────────────────────────────
# Orchestration: fetch + analyze + notify
# ──────────────────────────────────────────────

def run_daily_task(settings: dict, on_complete: Optional[Callable] = None) -> dict:
    """
    Full pipeline: fetch Google data → fetch AI tasks → AI analysis → send notification.

    Args:
        settings: User settings dict (must include anthropic_api_key, language, notification_enabled).
        on_complete: Optional callback with signature on_complete(result_dict).

    Returns:
        result dict with keys: calendar, tasks, ai_tasks, analysis, notification_sent, error.
    """
    from modules.google_services import fetch_all_today_items
    from modules.task_storage import get_today_tasks
    from modules.ai_analyzer import analyze_tasks
    from modules.notifier import send_notification, build_notification_summary
    from config.settings import ICON_PATH

    result = {
        "calendar": [],
        "tasks": [],
        "ai_tasks": [],
        "analysis": "",
        "notification_sent": False,
        "error": None,
        "timestamp": datetime.datetime.now().isoformat(),
    }

    # 1. Fetch Google data
    google_data = fetch_all_today_items()
    result["calendar"] = google_data.get("calendar", [])
    result["tasks"] = google_data.get("tasks", [])
    google_errors = google_data.get("errors", [])
    if google_errors:
        logger.warning("Google API 错误: %s", "; ".join(google_errors))

    # 2. Fetch AI conversation tasks
    result["ai_tasks"] = get_today_tasks()

    # 3. AI analysis
    api_key = settings.get("anthropic_api_key", "")
    language = settings.get("language", "zh")

    analysis_result = analyze_tasks(
        calendar_events=result["calendar"],
        google_tasks=result["tasks"],
        ai_tasks=result["ai_tasks"],
        api_key=api_key,
        language=language,
    )

    if analysis_result["success"]:
        result["analysis"] = analysis_result["analysis"]
    else:
        result["error"] = analysis_result.get("error", "AI分析失败")
        logger.error("AI分析失败: %s", result["error"])

    # 4. Desktop notification
    if settings.get("notification_enabled", True):
        # Extract first meaningful line of AI analysis as snippet
        snippet = ""
        if result["analysis"]:
            for line in result["analysis"].split("\n"):
                line = line.strip().lstrip("#").strip()
                if len(line) > 20:
                    snippet = line[:120]
                    break

        title, body = build_notification_summary(
            result["calendar"],
            result["tasks"],
            result["ai_tasks"],
            snippet,
        )
        icon = str(ICON_PATH) if ICON_PATH.exists() else None
        result["notification_sent"] = send_notification(title, body, icon)

    if on_complete:
        try:
            on_complete(result)
        except Exception as e:
            logger.exception("on_complete callback 异常: %s", e)

    return result
