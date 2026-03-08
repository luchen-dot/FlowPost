"""
Main GUI application using tkinter.
Provides:
  - Main window with today's tasks + AI analysis
  - Add/Edit/Delete AI conversation tasks
  - Settings panel (API key, reminder time, language)
  - System tray icon (pystray)
"""
import sys
import threading
import logging
import datetime
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, simpledialog
from typing import Optional

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Helper: Markdown-lite renderer for tkinter Text widget
# ──────────────────────────────────────────────────────────────────────────────

def _render_markdown_to_text(widget: tk.Text, text: str) -> None:
    """Simple markdown-lite renderer: bold(**), headers(#), bullets(-)."""
    widget.config(state=tk.NORMAL)
    widget.delete("1.0", tk.END)

    # Configure tags
    widget.tag_configure("h1", font=("Microsoft YaHei", 16, "bold"), foreground="#1a1a2e", spacing1=8, spacing3=4)
    widget.tag_configure("h2", font=("Microsoft YaHei", 13, "bold"), foreground="#16213e", spacing1=6, spacing3=2)
    widget.tag_configure("h3", font=("Microsoft YaHei", 11, "bold"), foreground="#0f3460", spacing1=4)
    widget.tag_configure("bold", font=("Microsoft YaHei", 10, "bold"))
    widget.tag_configure("bullet", lmargin1=20, lmargin2=30)
    widget.tag_configure("code", font=("Courier New", 9), background="#f0f0f0")
    widget.tag_configure("normal", font=("Microsoft YaHei", 10))
    widget.tag_configure("p1", foreground="#e74c3c", font=("Microsoft YaHei", 10, "bold"))
    widget.tag_configure("p2", foreground="#e67e22", font=("Microsoft YaHei", 10, "bold"))
    widget.tag_configure("p3", foreground="#27ae60", font=("Microsoft YaHei", 10))
    widget.tag_configure("p4", foreground="#7f8c8d", font=("Microsoft YaHei", 10))

    import re
    for line in text.split("\n"):
        if line.startswith("### "):
            widget.insert(tk.END, line[4:] + "\n", "h3")
        elif line.startswith("## "):
            widget.insert(tk.END, line[3:] + "\n", "h2")
        elif line.startswith("# "):
            widget.insert(tk.END, line[2:] + "\n", "h1")
        else:
            # Inline bold: **text**
            parts = re.split(r"\*\*(.+?)\*\*", line)
            is_bullet = line.strip().startswith(("- ", "• ", "* "))
            if is_bullet:
                indent = "  " * (len(line) - len(line.lstrip()))
                widget.insert(tk.END, indent + "• ", "bullet")
                stripped = line.strip().lstrip("-•* ")
                parts = re.split(r"\*\*(.+?)\*\*", stripped)
                for i, part in enumerate(parts):
                    tag = "bold" if i % 2 == 1 else "bullet"
                    widget.insert(tk.END, part, tag)
                widget.insert(tk.END, "\n")
            else:
                for i, part in enumerate(parts):
                    tag = "bold" if i % 2 == 1 else "normal"
                    widget.insert(tk.END, part, tag)
                widget.insert(tk.END, "\n")

    widget.config(state=tk.DISABLED)


# ──────────────────────────────────────────────────────────────────────────────
# Add Task Dialog
# ──────────────────────────────────────────────────────────────────────────────

class AddTaskDialog(tk.Toplevel):
    def __init__(self, parent, task: Optional[dict] = None):
        super().__init__(parent)
        self.result = None
        self._task = task  # existing task for editing

        self.title("编辑任务" if task else "添加 AI 工作事项")
        self.geometry("500x400")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        self._build_ui()
        if task:
            self._populate(task)

        self.wait_window()

    def _build_ui(self):
        pad = {"padx": 10, "pady": 5}
        frame = ttk.Frame(self, padding=15)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="标题 *").grid(row=0, column=0, sticky="w", **pad)
        self.title_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.title_var, width=45).grid(row=0, column=1, sticky="ew", **pad)

        ttk.Label(frame, text="描述").grid(row=1, column=0, sticky="nw", **pad)
        self.desc_text = scrolledtext.ScrolledText(frame, width=42, height=5, wrap=tk.WORD)
        self.desc_text.grid(row=1, column=1, sticky="ew", **pad)

        ttk.Label(frame, text="优先级").grid(row=2, column=0, sticky="w", **pad)
        self.priority_var = tk.StringVar(value="P3")
        priority_cb = ttk.Combobox(frame, textvariable=self.priority_var, values=["P1", "P2", "P3", "P4"], state="readonly", width=10)
        priority_cb.grid(row=2, column=1, sticky="w", **pad)

        ttk.Label(frame, text="截止日期").grid(row=3, column=0, sticky="w", **pad)
        self.due_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.due_var, width=15, placeholder_text="YYYY-MM-DD").grid(row=3, column=1, sticky="w", **pad)

        ttk.Label(frame, text="标签 (逗号分隔)").grid(row=4, column=0, sticky="w", **pad)
        self.tags_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.tags_var, width=30).grid(row=4, column=1, sticky="w", **pad)

        ttk.Label(frame, text="对话上下文").grid(row=5, column=0, sticky="nw", **pad)
        self.ctx_text = scrolledtext.ScrolledText(frame, width=42, height=3, wrap=tk.WORD)
        self.ctx_text.grid(row=5, column=1, sticky="ew", **pad)

        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=6, column=0, columnspan=2, pady=10)
        ttk.Button(btn_frame, text="保存", command=self._save).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="取消", command=self.destroy).pack(side=tk.LEFT, padx=5)

        frame.columnconfigure(1, weight=1)

    def _populate(self, task: dict):
        self.title_var.set(task.get("title", ""))
        self.desc_text.insert("1.0", task.get("description", ""))
        self.priority_var.set(task.get("priority", "P3"))
        self.due_var.set(task.get("due_date", ""))
        self.tags_var.set(", ".join(task.get("tags", [])))
        self.ctx_text.insert("1.0", task.get("source_context", ""))

    def _save(self):
        title = self.title_var.get().strip()
        if not title:
            messagebox.showwarning("警告", "标题不能为空", parent=self)
            return

        tags_raw = self.tags_var.get().strip()
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

        due = self.due_var.get().strip()
        if due:
            try:
                datetime.date.fromisoformat(due)
            except ValueError:
                messagebox.showwarning("警告", "截止日期格式应为 YYYY-MM-DD", parent=self)
                return

        self.result = {
            "title": title,
            "description": self.desc_text.get("1.0", tk.END).strip(),
            "priority": self.priority_var.get(),
            "tags": tags,
            "due_date": due,
            "source_context": self.ctx_text.get("1.0", tk.END).strip(),
        }
        self.destroy()


# ──────────────────────────────────────────────────────────────────────────────
# Settings Dialog
# ──────────────────────────────────────────────────────────────────────────────

class SettingsDialog(tk.Toplevel):
    def __init__(self, parent, settings: dict):
        super().__init__(parent)
        self.result = None
        self._settings = dict(settings)

        self.title("设置")
        self.geometry("480x320")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        self._build_ui()
        self.wait_window()

    def _build_ui(self):
        frame = ttk.Frame(self, padding=20)
        frame.pack(fill=tk.BOTH, expand=True)

        row = 0

        ttk.Label(frame, text="Anthropic API Key:").grid(row=row, column=0, sticky="w", pady=6)
        self.api_key_var = tk.StringVar(value=self._settings.get("anthropic_api_key", ""))
        ttk.Entry(frame, textvariable=self.api_key_var, width=38, show="*").grid(row=row, column=1, sticky="ew", padx=10)
        row += 1

        ttk.Label(frame, text="每日推送时间 (HH:MM):").grid(row=row, column=0, sticky="w", pady=6)
        self.time_var = tk.StringVar(value=self._settings.get("reminder_time", "08:00"))
        ttk.Entry(frame, textvariable=self.time_var, width=10).grid(row=row, column=1, sticky="w", padx=10)
        row += 1

        ttk.Label(frame, text="语言:").grid(row=row, column=0, sticky="w", pady=6)
        self.lang_var = tk.StringVar(value=self._settings.get("language", "zh"))
        lang_cb = ttk.Combobox(frame, textvariable=self.lang_var, values=["zh", "en"], state="readonly", width=8)
        lang_cb.grid(row=row, column=1, sticky="w", padx=10)
        row += 1

        self.notif_var = tk.BooleanVar(value=self._settings.get("notification_enabled", True))
        ttk.Checkbutton(frame, text="启用桌面通知", variable=self.notif_var).grid(row=row, column=0, columnspan=2, sticky="w", pady=6)
        row += 1

        self.autostart_var = tk.BooleanVar(value=self._settings.get("auto_start", False))
        ttk.Checkbutton(frame, text="开机自动启动 (需手动配置系统)", variable=self.autostart_var).grid(row=row, column=0, columnspan=2, sticky="w", pady=6)
        row += 1

        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=row, column=0, columnspan=2, pady=15)
        ttk.Button(btn_frame, text="保存", command=self._save).pack(side=tk.LEFT, padx=8)
        ttk.Button(btn_frame, text="取消", command=self.destroy).pack(side=tk.LEFT, padx=8)

        frame.columnconfigure(1, weight=1)

    def _save(self):
        t = self.time_var.get().strip()
        try:
            datetime.datetime.strptime(t, "%H:%M")
        except ValueError:
            messagebox.showwarning("警告", "时间格式应为 HH:MM，例如 08:30", parent=self)
            return

        self.result = {
            "anthropic_api_key": self.api_key_var.get().strip(),
            "reminder_time": t,
            "language": self.lang_var.get(),
            "notification_enabled": self.notif_var.get(),
            "auto_start": self.autostart_var.get(),
        }
        self.destroy()


# ──────────────────────────────────────────────────────────────────────────────
# Main Application Window
# ──────────────────────────────────────────────────────────────────────────────

class MainApp(tk.Tk):
    def __init__(self):
        super().__init__()
        from config.settings import APP_NAME, APP_VERSION, WINDOW_WIDTH, WINDOW_HEIGHT, load_user_settings
        from modules.scheduler import DailyScheduler, run_daily_task
        from modules.task_storage import get_all_tasks, add_task, update_task, delete_task, mark_done

        self._settings = load_user_settings()
        self._last_result: Optional[dict] = None

        self.title(f"{APP_NAME} v{APP_VERSION}")
        self.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.minsize(700, 500)

        self._run_daily_task = run_daily_task
        self._get_all_tasks = get_all_tasks
        self._add_task = add_task
        self._update_task = update_task
        self._delete_task = delete_task
        self._mark_done = mark_done

        self._build_ui()
        self._setup_tray()

        # Start scheduler
        self._scheduler = DailyScheduler(self._on_scheduler_trigger, self._settings)
        self._scheduler.start()

        # Auto-refresh AI task list
        self._refresh_ai_tasks()

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ──────────────────────────────────────────────
    # UI Construction
    # ──────────────────────────────────────────────

    def _build_ui(self):
        # Menu
        menubar = tk.Menu(self)
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="立即推送", command=self._manual_trigger)
        file_menu.add_separator()
        file_menu.add_command(label="设置", command=self._open_settings)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self._quit_app)
        menubar.add_cascade(label="文件", menu=file_menu)

        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label="关于", command=self._show_about)
        menubar.add_cascade(label="帮助", menu=help_menu)
        self.config(menu=menubar)

        # Status bar
        self._status_var = tk.StringVar(value="就绪")
        status_bar = ttk.Label(self, textvariable=self._status_var, relief=tk.SUNKEN, anchor="w", padding=(5, 2))
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        # Toolbar
        toolbar = ttk.Frame(self, padding=(5, 3))
        toolbar.pack(side=tk.TOP, fill=tk.X)
        ttk.Button(toolbar, text="🔄 立即推送", command=self._manual_trigger).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="➕ 添加工作事项", command=self._add_ai_task).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="⚙ 设置", command=self._open_settings).pack(side=tk.RIGHT, padx=3)

        # Reminder time display
        self._time_label = ttk.Label(toolbar, text=f"每日推送: {self._settings.get('reminder_time', '08:00')}")
        self._time_label.pack(side=tk.RIGHT, padx=10)

        # Main notebook
        notebook = ttk.Notebook(self)
        notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Tab 1: Today's Summary
        self._summary_frame = ttk.Frame(notebook)
        notebook.add(self._summary_frame, text="📋 今日汇总")
        self._build_summary_tab()

        # Tab 2: AI Analysis
        self._analysis_frame = ttk.Frame(notebook)
        notebook.add(self._analysis_frame, text="🤖 AI分析建议")
        self._build_analysis_tab()

        # Tab 3: AI Work Items
        self._tasks_frame = ttk.Frame(notebook)
        notebook.add(self._tasks_frame, text="✅ AI工作事项")
        self._build_tasks_tab()

    def _build_summary_tab(self):
        frame = self._summary_frame
        paned = ttk.PanedWindow(frame, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Calendar section
        cal_frame = ttk.LabelFrame(paned, text="📅 Google Calendar 日程", padding=5)
        self._cal_listbox = tk.Listbox(cal_frame, font=("Microsoft YaHei", 9), selectmode=tk.SINGLE)
        cal_scroll = ttk.Scrollbar(cal_frame, orient=tk.VERTICAL, command=self._cal_listbox.yview)
        self._cal_listbox.config(yscrollcommand=cal_scroll.set)
        cal_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._cal_listbox.pack(fill=tk.BOTH, expand=True)
        paned.add(cal_frame, weight=1)

        # Tasks section
        tasks_frame = ttk.LabelFrame(paned, text="✅ Google Tasks", padding=5)
        self._gtasks_listbox = tk.Listbox(tasks_frame, font=("Microsoft YaHei", 9), selectmode=tk.SINGLE)
        gt_scroll = ttk.Scrollbar(tasks_frame, orient=tk.VERTICAL, command=self._gtasks_listbox.yview)
        self._gtasks_listbox.config(yscrollcommand=gt_scroll.set)
        gt_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._gtasks_listbox.pack(fill=tk.BOTH, expand=True)
        paned.add(tasks_frame, weight=1)

    def _build_analysis_tab(self):
        frame = self._analysis_frame
        self._analysis_text = scrolledtext.ScrolledText(
            frame,
            wrap=tk.WORD,
            font=("Microsoft YaHei", 10),
            state=tk.DISABLED,
            padx=10,
            pady=10,
        )
        self._analysis_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        placeholder = "点击工具栏「立即推送」按钮获取 AI 分析建议 ✨"
        self._analysis_text.config(state=tk.NORMAL)
        self._analysis_text.insert("1.0", placeholder)
        self._analysis_text.config(state=tk.DISABLED)

    def _build_tasks_tab(self):
        frame = self._tasks_frame

        # Toolbar
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=tk.X, padx=5, pady=3)
        ttk.Button(btn_frame, text="➕ 添加", command=self._add_ai_task).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="✏️ 编辑", command=self._edit_ai_task).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="✅ 完成", command=self._complete_ai_task).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="🗑️ 删除", command=self._delete_ai_task).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="🔄 刷新", command=self._refresh_ai_tasks).pack(side=tk.RIGHT, padx=2)

        # Filter
        filter_frame = ttk.Frame(frame)
        filter_frame.pack(fill=tk.X, padx=5, pady=2)
        ttk.Label(filter_frame, text="状态筛选:").pack(side=tk.LEFT)
        self._filter_var = tk.StringVar(value="active")
        for val, lbl in [("active", "进行中"), ("all", "全部"), ("done", "已完成")]:
            ttk.Radiobutton(filter_frame, text=lbl, variable=self._filter_var, value=val, command=self._refresh_ai_tasks).pack(side=tk.LEFT, padx=4)

        # Treeview
        cols = ("priority", "title", "due", "status", "tags")
        self._tasks_tree = ttk.Treeview(frame, columns=cols, show="headings", selectmode=tk.BROWSE)
        self._tasks_tree.heading("priority", text="优先级")
        self._tasks_tree.heading("title", text="标题")
        self._tasks_tree.heading("due", text="截止日期")
        self._tasks_tree.heading("status", text="状态")
        self._tasks_tree.heading("tags", text="标签")

        self._tasks_tree.column("priority", width=60, anchor="center")
        self._tasks_tree.column("title", width=240)
        self._tasks_tree.column("due", width=90, anchor="center")
        self._tasks_tree.column("status", width=70, anchor="center")
        self._tasks_tree.column("tags", width=120)

        tree_scroll = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self._tasks_tree.yview)
        self._tasks_tree.config(yscrollcommand=tree_scroll.set)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._tasks_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=3)

        # Tag colors
        self._tasks_tree.tag_configure("P1", foreground="#e74c3c")
        self._tasks_tree.tag_configure("P2", foreground="#e67e22")
        self._tasks_tree.tag_configure("P3", foreground="#27ae60")
        self._tasks_tree.tag_configure("P4", foreground="#7f8c8d")
        self._tasks_tree.tag_configure("done", foreground="#aaaaaa")

        self._tasks_tree.bind("<Double-1>", lambda e: self._edit_ai_task())

        # Store task id mapping
        self._tree_id_map: dict[str, str] = {}  # tree_item_id -> task_id

    # ──────────────────────────────────────────────
    # System Tray
    # ──────────────────────────────────────────────

    def _setup_tray(self):
        try:
            import pystray
            from PIL import Image, ImageDraw

            # Create a simple icon
            img = Image.new("RGB", (64, 64), color="#2196F3")
            draw = ImageDraw.Draw(img)
            draw.text((8, 20), "DR", fill="white")

            menu = pystray.Menu(
                pystray.MenuItem("显示", self._show_window, default=True),
                pystray.MenuItem("立即推送", self._manual_trigger),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("退出", self._quit_app),
            )
            self._tray_icon = pystray.Icon("DailyReminder", img, "每日任务提醒", menu)
            tray_thread = threading.Thread(target=self._tray_icon.run, daemon=True)
            tray_thread.start()
        except ImportError:
            self._tray_icon = None
            logger.info("pystray/Pillow 未安装，系统托盘不可用")

    # ──────────────────────────────────────────────
    # Actions
    # ──────────────────────────────────────────────

    def _manual_trigger(self):
        self._status_var.set("正在获取数据并进行 AI 分析，请稍候…")
        self.update_idletasks()

        def run():
            result = self._run_daily_task(self._settings, on_complete=None)
            self.after(0, lambda: self._on_result(result))

        threading.Thread(target=run, daemon=True).start()

    def _on_scheduler_trigger(self):
        """Called by scheduler thread — must schedule UI update on main thread."""
        result = self._run_daily_task(self._settings)
        self.after(0, lambda: self._on_result(result))

    def _on_result(self, result: dict):
        self._last_result = result
        self._update_summary(result)
        self._update_analysis(result)
        self._refresh_ai_tasks()

        if result.get("error"):
            self._status_var.set(f"⚠ {result['error']}")
        else:
            ts = datetime.datetime.now().strftime("%H:%M:%S")
            cal_count = len(result.get("calendar", []))
            task_count = len(result.get("tasks", []))
            ai_count = len(result.get("ai_tasks", []))
            self._status_var.set(
                f"最后更新: {ts} | 日程 {cal_count} | Tasks {task_count} | AI事项 {ai_count}"
            )

    def _update_summary(self, result: dict):
        # Calendar
        self._cal_listbox.delete(0, tk.END)
        for e in result.get("calendar", []):
            start = e.get("start", "")
            if "T" in start:
                try:
                    import datetime as dt_mod
                    d = dt_mod.datetime.fromisoformat(start.replace("Z", "+00:00"))
                    start = d.strftime("%H:%M")
                except ValueError:
                    pass
            self._cal_listbox.insert(tk.END, f"  {start}  {e['title']}")

        if not result.get("calendar"):
            self._cal_listbox.insert(tk.END, "  (今日无日程)")

        # Tasks
        self._gtasks_listbox.delete(0, tk.END)
        for t in result.get("tasks", []):
            due = f"[{t.get('due_date', '')}]" if t.get("due_date") else ""
            self._gtasks_listbox.insert(tk.END, f"  {due} {t['title']}")

        if not result.get("tasks"):
            self._gtasks_listbox.insert(tk.END, "  (无待完成 Tasks)")

    def _update_analysis(self, result: dict):
        analysis = result.get("analysis", "")
        if not analysis and result.get("error"):
            analysis = f"⚠ 错误: {result['error']}"
        elif not analysis:
            analysis = "(无 AI 分析内容)"
        _render_markdown_to_text(self._analysis_text, analysis)

    def _refresh_ai_tasks(self):
        filter_val = self._filter_var.get() if hasattr(self, "_filter_var") else "active"
        include_done = filter_val in ("all", "done")
        tasks = self._get_all_tasks(include_done=include_done)

        if filter_val == "done":
            tasks = [t for t in tasks if t.get("status") == "done"]
        elif filter_val == "active":
            tasks = [t for t in tasks if t.get("status") != "done"]

        # Clear tree
        for item in self._tasks_tree.get_children():
            self._tasks_tree.delete(item)
        self._tree_id_map.clear()

        status_zh = {"pending": "待处理", "in_progress": "进行中", "done": "已完成"}
        for t in tasks:
            priority = t.get("priority", "P4")
            status = t.get("status", "pending")
            tags = ", ".join(t.get("tags", []))
            tree_tag = "done" if status == "done" else priority
            iid = self._tasks_tree.insert(
                "", tk.END,
                values=(priority, t["title"], t.get("due_date", ""), status_zh.get(status, status), tags),
                tags=(tree_tag,),
            )
            self._tree_id_map[iid] = t["id"]

    def _get_selected_task_id(self) -> Optional[str]:
        sel = self._tasks_tree.selection()
        if not sel:
            return None
        return self._tree_id_map.get(sel[0])

    def _add_ai_task(self):
        dlg = AddTaskDialog(self)
        if dlg.result:
            self._add_task(**dlg.result)
            self._refresh_ai_tasks()
            self._status_var.set("已添加工作事项")

    def _edit_ai_task(self):
        task_id = self._get_selected_task_id()
        if not task_id:
            messagebox.showinfo("提示", "请先选择一个任务", parent=self)
            return

        tasks = self._get_all_tasks(include_done=True)
        task = next((t for t in tasks if t["id"] == task_id), None)
        if not task:
            return

        dlg = AddTaskDialog(self, task=task)
        if dlg.result:
            self._update_task(task_id, **dlg.result)
            self._refresh_ai_tasks()
            self._status_var.set("已更新工作事项")

    def _complete_ai_task(self):
        task_id = self._get_selected_task_id()
        if not task_id:
            messagebox.showinfo("提示", "请先选择一个任务", parent=self)
            return
        from modules.task_storage import mark_done
        mark_done(task_id)
        self._refresh_ai_tasks()
        self._status_var.set("已标记为完成")

    def _delete_ai_task(self):
        task_id = self._get_selected_task_id()
        if not task_id:
            messagebox.showinfo("提示", "请先选择一个任务", parent=self)
            return
        if messagebox.askyesno("确认删除", "确定要删除该任务吗？", parent=self):
            from modules.task_storage import delete_task
            delete_task(task_id)
            self._refresh_ai_tasks()
            self._status_var.set("已删除任务")

    def _open_settings(self):
        dlg = SettingsDialog(self, self._settings)
        if dlg.result:
            from config.settings import save_user_settings
            self._settings.update(dlg.result)
            save_user_settings(self._settings)
            self._scheduler.update_time(self._settings["reminder_time"])
            self._time_label.config(text=f"每日推送: {self._settings['reminder_time']}")
            self._status_var.set("设置已保存")

    def _show_about(self):
        from config.settings import APP_NAME, APP_VERSION
        messagebox.showinfo(
            "关于",
            f"{APP_NAME} v{APP_VERSION}\n\n"
            "自动整合 Google Calendar、Google Tasks 和 AI 对话工作事项，\n"
            "每日定时推送 AI 优先级分析和执行建议。\n\n"
            "Powered by Claude API (Anthropic)",
            parent=self,
        )

    # ──────────────────────────────────────────────
    # Window lifecycle
    # ──────────────────────────────────────────────

    def _show_window(self):
        self.deiconify()
        self.lift()
        self.focus_force()

    def _on_close(self):
        if self._tray_icon:
            self.withdraw()  # minimize to tray
        else:
            self._quit_app()

    def _quit_app(self):
        self._scheduler.stop()
        if self._tray_icon:
            try:
                self._tray_icon.stop()
            except Exception:
                pass
        self.destroy()
