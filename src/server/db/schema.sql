-- FlowPost Database Schema v1.0
-- Phase 1 tables: topics, posts, post_versions, templates, ai_settings
-- Phase 2 tables: rss_sources, feed_items, kb_documents, kb_chunks, kb_topic_suggestions, notion_config

-- 选题表
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  -- 来源类型: manual | rss | github | viral_clone | kb_extract
  source_ref TEXT,
  status TEXT DEFAULT 'inbox',
  -- 状态: inbox | writing | done | archived
  platform TEXT DEFAULT 'xiaohongshu',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 内容草稿表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER REFERENCES topics(id),
  platform TEXT NOT NULL DEFAULT 'xiaohongshu',
  -- 平台: xiaohongshu | wechat | jike | twitter
  title TEXT,
  body TEXT,
  card_data TEXT,
  -- JSON: { brief, titles, selectedTitle, cards, hashtags, style }
  template_id INTEGER,
  ai_provider TEXT,
  status TEXT DEFAULT 'draft',
  -- 状态: draft | reviewed | exported
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 版本历史表
CREATE TABLE IF NOT EXISTS post_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id),
  body TEXT,
  card_data TEXT,
  version INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 卡片模板表
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT,
  card_data TEXT,
  -- JSON: 模板样式数据
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI 设置表
CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL UNIQUE,
  -- claude | openai | gemini | deepseek
  model TEXT NOT NULL,
  api_key TEXT DEFAULT '',
  enabled INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 0,
  -- 当前激活的主 Provider
  task_routing TEXT DEFAULT '{}',
  -- JSON: 任务路由配置
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- RSS 源表
CREATE TABLE IF NOT EXISTS rss_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT,
  enabled INTEGER DEFAULT 1,
  last_fetched DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 热点抓取缓存表
CREATE TABLE IF NOT EXISTS feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,
  source_name TEXT,
  title TEXT,
  url TEXT,
  summary TEXT,
  published_at DATETIME,
  saved_as_topic INTEGER DEFAULT 0,
  relevance_score REAL,
  trendradar_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 知识库：原始文档表
CREATE TABLE IF NOT EXISTS kb_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  notion_page_id TEXT UNIQUE,
  notion_last_edited DATETIME,
  category TEXT,
  raw_text TEXT,
  file_type TEXT,
  chunk_count INTEGER DEFAULT 0,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 知识库：切片表
CREATE TABLE IF NOT EXISTS kb_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES kb_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER,
  embedding TEXT,
  -- JSON 数组: 向量
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 知识库：选题建议表
CREATE TABLE IF NOT EXISTS kb_topic_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  angle TEXT,
  source_chunks TEXT,
  source_summary TEXT,
  status TEXT DEFAULT 'pending',
  -- pending | adopted | dismissed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TrendRadar 集成配置表
CREATE TABLE IF NOT EXISTS trendradar_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  db_path TEXT,
  min_relevance REAL DEFAULT 0.6,
  topic_keywords TEXT DEFAULT '["AI","人工智能","大模型","LLM","GPT","Claude","创作","内容","写作","自媒体","博主","运营"]',
  auto_sync INTEGER DEFAULT 0,
  sync_interval_hours INTEGER DEFAULT 6,
  last_synced_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NewsNow 直连配置表
CREATE TABLE IF NOT EXISTS newsnow_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  interest_description TEXT DEFAULT '',
  -- 自然语言兴趣描述，用于 Claude 打分
  platforms TEXT DEFAULT '["zhihu","weibo","bilibili","baidu","toutiao"]',
  -- JSON 数组: 抓取的平台 ID 列表
  keywords TEXT DEFAULT '[]',
  -- JSON 数组: 关键词预过滤列表（空则不过滤）
  min_relevance REAL DEFAULT 0.6,
  use_ai_filter INTEGER DEFAULT 1,
  -- 是否启用 Claude AI 打分
  last_synced_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notion 同步配置表
CREATE TABLE IF NOT EXISTS notion_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_token TEXT,
  database_id TEXT,
  last_synced DATETIME,
  sync_enabled INTEGER DEFAULT 1,
  sync_schedule TEXT DEFAULT '22:00',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认 AI Provider 配置
INSERT OR IGNORE INTO ai_settings (provider, model, enabled, is_active, task_routing) VALUES
  ('Claude', 'claude-sonnet-4-5', 0, 0, '{"draft_generate":"Claude","polish":"Claude","rewrite":"Claude"}'),
  ('OpenAI', 'gpt-4o-mini', 0, 0, '{}'),
  ('Gemini', 'gemini-1.5-flash', 0, 0, '{}'),
  ('DeepSeek', 'deepseek-chat', 0, 0, '{}');

-- 插入默认 RSS 源
INSERT OR IGNORE INTO rss_sources (name, url, category) VALUES
  ('少数派', 'https://sspai.com/feed', 'productivity'),
  ('Hacker News', 'https://hnrss.org/frontpage', 'tech'),
  ('Product Hunt', 'https://www.producthunt.com/feed', 'tech');
