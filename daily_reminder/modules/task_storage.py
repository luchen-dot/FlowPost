"""
Local task storage for AI conversation work items.
Provides CRUD operations backed by a JSON file.
"""
import json
import uuid
import datetime
from pathlib import Path
from typing import Optional

from config.settings import TASKS_DB_FILE


PRIORITY_LEVELS = ["P1", "P2", "P3", "P4"]
STATUS_VALUES = ["pending", "in_progress", "done"]


def _load_db() -> dict:
    """Load the task database from disk."""
    if TASKS_DB_FILE.exists():
        try:
            with open(TASKS_DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"tasks": [], "version": 1}


def _save_db(db: dict) -> None:
    """Persist the task database to disk."""
    TASKS_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(TASKS_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def add_task(
    title: str,
    description: str = "",
    priority: str = "P3",
    tags: Optional[list[str]] = None,
    due_date: Optional[str] = None,   # ISO date string, e.g. "2026-03-10"
    source_context: str = "",          # snippet from AI conversation
) -> dict:
    """
    Add a new work item from an AI conversation.
    Returns the created task dict.
    """
    if priority not in PRIORITY_LEVELS:
        priority = "P3"

    task = {
        "id": str(uuid.uuid4()),
        "title": title.strip(),
        "description": description.strip(),
        "priority": priority,
        "tags": tags or [],
        "due_date": due_date or "",
        "source_context": source_context,
        "status": "pending",
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat(),
    }

    db = _load_db()
    db["tasks"].append(task)
    _save_db(db)
    return task


def get_all_tasks(include_done: bool = False) -> list[dict]:
    """Return all AI conversation tasks, optionally filtering out completed ones."""
    db = _load_db()
    tasks = db.get("tasks", [])
    if not include_done:
        tasks = [t for t in tasks if t.get("status") != "done"]
    # Sort by priority then creation time
    priority_order = {p: i for i, p in enumerate(PRIORITY_LEVELS)}
    tasks.sort(key=lambda t: (priority_order.get(t.get("priority", "P4"), 99), t.get("created_at", "")))
    return tasks


def get_today_tasks() -> list[dict]:
    """Return tasks that are due today or have no due date (pending/in_progress)."""
    today = str(datetime.date.today())
    tasks = get_all_tasks(include_done=False)
    today_tasks = []
    for t in tasks:
        due = t.get("due_date", "")
        if not due or due <= today:
            today_tasks.append(t)
    return today_tasks


def update_task(task_id: str, **kwargs) -> Optional[dict]:
    """
    Update fields of an existing task.
    Allowed kwargs: title, description, priority, tags, due_date, status, source_context.
    Returns updated task or None if not found.
    """
    allowed = {"title", "description", "priority", "tags", "due_date", "status", "source_context"}
    db = _load_db()
    for task in db["tasks"]:
        if task["id"] == task_id:
            for key, value in kwargs.items():
                if key in allowed:
                    if key == "priority" and value not in PRIORITY_LEVELS:
                        continue
                    if key == "status" and value not in STATUS_VALUES:
                        continue
                    task[key] = value
            task["updated_at"] = datetime.datetime.now().isoformat()
            _save_db(db)
            return task
    return None


def delete_task(task_id: str) -> bool:
    """Delete a task by ID. Returns True if deleted, False if not found."""
    db = _load_db()
    original_len = len(db["tasks"])
    db["tasks"] = [t for t in db["tasks"] if t["id"] != task_id]
    if len(db["tasks"]) < original_len:
        _save_db(db)
        return True
    return False


def mark_done(task_id: str) -> bool:
    """Mark a task as done. Returns True on success."""
    result = update_task(task_id, status="done")
    return result is not None


def search_tasks(query: str, include_done: bool = False) -> list[dict]:
    """Full-text search across title, description, and tags."""
    query_lower = query.lower()
    tasks = get_all_tasks(include_done=include_done)
    results = []
    for t in tasks:
        searchable = " ".join([
            t.get("title", ""),
            t.get("description", ""),
            " ".join(t.get("tags", [])),
        ]).lower()
        if query_lower in searchable:
            results.append(t)
    return results


def get_task_stats() -> dict:
    """Return a summary of task counts by status and priority."""
    db = _load_db()
    all_tasks = db.get("tasks", [])
    stats = {
        "total": len(all_tasks),
        "pending": sum(1 for t in all_tasks if t.get("status") == "pending"),
        "in_progress": sum(1 for t in all_tasks if t.get("status") == "in_progress"),
        "done": sum(1 for t in all_tasks if t.get("status") == "done"),
        "by_priority": {p: 0 for p in PRIORITY_LEVELS},
    }
    for t in all_tasks:
        p = t.get("priority", "P4")
        if p in stats["by_priority"]:
            stats["by_priority"][p] += 1
    return stats
