"""
Desktop notification module.
Sends system-level desktop notifications with task summaries.
"""
import sys
import subprocess
from typing import Optional


def _notify_linux(title: str, body: str, icon: Optional[str] = None) -> bool:
    """Send notification on Linux via notify-send."""
    try:
        cmd = ["notify-send", title, body, "--urgency=normal", "--expire-time=10000"]
        if icon:
            cmd += [f"--icon={icon}"]
        subprocess.run(cmd, check=True, capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def _notify_macos(title: str, body: str) -> bool:
    """Send notification on macOS via osascript."""
    script = f'display notification "{body}" with title "{title}"'
    try:
        subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def _notify_windows(title: str, body: str) -> bool:
    """Send notification on Windows via plyer or win10toast."""
    try:
        from plyer import notification
        notification.notify(
            title=title,
            message=body[:256],
            app_name="Daily Task Reminder",
            timeout=10,
        )
        return True
    except ImportError:
        pass
    try:
        from win10toast import ToastNotifier
        ToastNotifier().show_toast(title, body[:256], duration=10, threaded=True)
        return True
    except ImportError:
        return False


def send_notification(title: str, body: str, icon_path: Optional[str] = None) -> bool:
    """
    Send a desktop notification using the appropriate method for the OS.
    Returns True if notification was sent successfully.
    """
    platform = sys.platform

    # Truncate body to avoid notification limits
    body = body[:512] if len(body) > 512 else body

    if platform.startswith("linux"):
        return _notify_linux(title, body, icon_path)
    elif platform == "darwin":
        return _notify_macos(title, body)
    elif platform == "win32":
        return _notify_windows(title, body)
    else:
        # Fallback: try plyer (cross-platform)
        try:
            from plyer import notification
            notification.notify(title=title, message=body, timeout=10)
            return True
        except Exception:
            return False


def build_notification_summary(
    calendar_events: list[dict],
    google_tasks: list[dict],
    ai_tasks: list[dict],
    analysis_snippet: str = "",
) -> tuple[str, str]:
    """
    Build a concise notification title + body from today's items.
    Returns (title, body).
    """
    total = len(calendar_events) + len(google_tasks) + len(ai_tasks)
    title = f"今日待办提醒 — 共 {total} 项"

    lines = []

    if calendar_events:
        lines.append(f"📅 日程 {len(calendar_events)} 项:")
        for e in calendar_events[:3]:
            start = e.get("start", "")
            if "T" in start:
                import datetime
                try:
                    dt = datetime.datetime.fromisoformat(start.replace("Z", "+00:00"))
                    start = dt.strftime("%H:%M")
                except ValueError:
                    pass
            lines.append(f"  • {start} {e['title']}")
        if len(calendar_events) > 3:
            lines.append(f"  … 等共 {len(calendar_events)} 项")

    if google_tasks:
        lines.append(f"\n✅ Tasks {len(google_tasks)} 项:")
        for t in google_tasks[:3]:
            lines.append(f"  • {t['title']}")
        if len(google_tasks) > 3:
            lines.append(f"  … 等共 {len(google_tasks)} 项")

    if ai_tasks:
        lines.append(f"\n🤖 AI工作事项 {len(ai_tasks)} 项:")
        for t in ai_tasks[:3]:
            p = t.get("priority", "")
            lines.append(f"  • [{p}] {t['title']}")
        if len(ai_tasks) > 3:
            lines.append(f"  … 等共 {len(ai_tasks)} 项")

    if analysis_snippet:
        lines.append(f"\n💡 AI建议: {analysis_snippet[:120]}")

    body = "\n".join(lines)
    return title, body
