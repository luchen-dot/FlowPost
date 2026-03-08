"""
Application settings and configuration management.
"""
import os
import json
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).parent.parent
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Google API credentials
GOOGLE_CREDENTIALS_FILE = CONFIG_DIR / "credentials.json"
GOOGLE_TOKEN_FILE = DATA_DIR / "token.json"
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/tasks.readonly",
]

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Scheduler settings
DEFAULT_REMINDER_TIME = "08:00"   # Daily push time (HH:MM)
REMINDER_INTERVAL_HOURS = 0       # 0 = once per day at reminder_time

# UI settings
APP_NAME = "Daily Task Reminder"
APP_VERSION = "1.0.0"
ICON_PATH = BASE_DIR / "assets" / "icon.png"
WINDOW_WIDTH = 800
WINDOW_HEIGHT = 600

# Storage
TASKS_DB_FILE = DATA_DIR / "tasks.json"
USER_SETTINGS_FILE = DATA_DIR / "user_settings.json"

# AI model
AI_MODEL = "claude-sonnet-4-6"
AI_MAX_TOKENS = 2048


def load_user_settings() -> dict:
    """Load user settings from file."""
    defaults = {
        "reminder_time": DEFAULT_REMINDER_TIME,
        "anthropic_api_key": ANTHROPIC_API_KEY,
        "auto_start": False,
        "notification_enabled": True,
        "language": "zh",  # 'zh' or 'en'
    }
    if USER_SETTINGS_FILE.exists():
        try:
            with open(USER_SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                defaults.update(saved)
        except (json.JSONDecodeError, IOError):
            pass
    return defaults


def save_user_settings(settings: dict) -> None:
    """Save user settings to file."""
    with open(USER_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
