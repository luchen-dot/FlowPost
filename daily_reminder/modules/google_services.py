"""
Google Calendar and Google Tasks API integration.
Handles OAuth2 authentication and data fetching.
"""
import json
import datetime
from pathlib import Path
from typing import Optional

try:
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

from config.settings import (
    GOOGLE_CREDENTIALS_FILE,
    GOOGLE_TOKEN_FILE,
    GOOGLE_SCOPES,
)


class GoogleServicesError(Exception):
    pass


def _get_credentials() -> Optional[object]:
    """Obtain or refresh Google OAuth2 credentials."""
    if not GOOGLE_AVAILABLE:
        raise GoogleServicesError(
            "Google API libraries not installed. Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
        )

    creds = None

    if GOOGLE_TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(GOOGLE_TOKEN_FILE), GOOGLE_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not GOOGLE_CREDENTIALS_FILE.exists():
                raise GoogleServicesError(
                    f"Google credentials file not found: {GOOGLE_CREDENTIALS_FILE}\n"
                    "Please download credentials.json from Google Cloud Console."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(GOOGLE_CREDENTIALS_FILE), GOOGLE_SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open(GOOGLE_TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return creds


def fetch_calendar_events(days_ahead: int = 0) -> list[dict]:
    """
    Fetch Google Calendar events for today (and optionally upcoming days).
    Returns a list of event dicts with keys: title, start, end, description, location, status.
    """
    creds = _get_credentials()
    service = build("calendar", "v3", credentials=creds)

    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + datetime.timedelta(days=max(1, days_ahead + 1))

    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=today_start.isoformat(),
            timeMax=today_end.isoformat(),
            maxResults=50,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    raw_events = events_result.get("items", [])

    events = []
    for e in raw_events:
        start = e.get("start", {})
        end = e.get("end", {})
        events.append(
            {
                "source": "google_calendar",
                "title": e.get("summary", "(无标题)"),
                "start": start.get("dateTime", start.get("date", "")),
                "end": end.get("dateTime", end.get("date", "")),
                "description": e.get("description", ""),
                "location": e.get("location", ""),
                "status": e.get("status", "confirmed"),
                "html_link": e.get("htmlLink", ""),
            }
        )
    return events


def fetch_tasks() -> list[dict]:
    """
    Fetch Google Tasks from all task lists that are not completed.
    Returns a list of task dicts with keys: title, notes, due, status, task_list.
    """
    creds = _get_credentials()
    service = build("tasks", "v1", credentials=creds)

    # Get all task lists
    tasklists_result = service.tasklists().list(maxResults=20).execute()
    tasklists = tasklists_result.get("items", [])

    all_tasks = []
    today = datetime.date.today()

    for tasklist in tasklists:
        tl_id = tasklist["id"]
        tl_title = tasklist["title"]

        tasks_result = (
            service.tasks()
            .list(
                tasklist=tl_id,
                showCompleted=False,
                showHidden=False,
                maxResults=100,
            )
            .execute()
        )
        tasks = tasks_result.get("items", [])

        for t in tasks:
            due_str = t.get("due", "")
            # Include tasks with no due date or due today/overdue
            include = True
            due_date = None
            if due_str:
                try:
                    due_date = datetime.datetime.fromisoformat(
                        due_str.replace("Z", "+00:00")
                    ).date()
                    include = due_date <= today
                except ValueError:
                    pass

            if include and t.get("status") != "completed":
                all_tasks.append(
                    {
                        "source": "google_tasks",
                        "title": t.get("title", "(无标题)"),
                        "notes": t.get("notes", ""),
                        "due": due_str,
                        "due_date": str(due_date) if due_date else "",
                        "status": t.get("status", "needsAction"),
                        "task_list": tl_title,
                        "id": t.get("id", ""),
                        "parent": t.get("parent", ""),
                    }
                )

    return all_tasks


def fetch_all_today_items() -> dict:
    """
    Convenience function: fetch both calendar events and tasks.
    Returns: {"calendar": [...], "tasks": [...]}
    """
    result = {"calendar": [], "tasks": []}
    errors = []

    try:
        result["calendar"] = fetch_calendar_events()
    except GoogleServicesError as e:
        errors.append(f"Google Calendar: {e}")
    except Exception as e:
        errors.append(f"Google Calendar (未知错误): {e}")

    try:
        result["tasks"] = fetch_tasks()
    except GoogleServicesError as e:
        errors.append(f"Google Tasks: {e}")
    except Exception as e:
        errors.append(f"Google Tasks (未知错误): {e}")

    result["errors"] = errors
    return result
