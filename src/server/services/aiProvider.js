import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'
import db from '../db/database.js'

export const PROVIDERS = {
  Claude: {
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    baseURL: 'https://api.anthropic.com/v1',
  },
  OpenAI: {
    models: ['gpt-4o', 'gpt-4o-mini'],
    baseURL: 'https://api.openai.com/v1',
  },
  Gemini: {
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  DeepSeek: {
    models: ['deepseek-chat'],
    baseURL: 'https://api.deepseek.com/v1',
  },
}

const DEFAULT_TASK_ROUTING = {
  draft_generate: 'Claude',
  polish: 'Claude',
  rewrite: 'Claude',
}

function getSettingForProvider(providerName) {
  return db.prepare('SELECT * FROM ai_settings WHERE provider = ? AND enabled = 1').get(providerName)
}

function getTaskRouting() {
  const active = db.prepare('SELECT task_routing FROM ai_settings WHERE is_active = 1').get()
  if (active?.task_routing) {
    try {
      const parsed = JSON.parse(active.task_routing)
      return { ...DEFAULT_TASK_ROUTING, ...parsed }
    } catch {}
  }
  return DEFAULT_TASK_ROUTING
}

function getProviderForTask(task) {
  const routing = getTaskRouting()
  return routing[task] || 'Claude'
}

async function generateWithClaude(apiKey, model, systemPrompt, messages, onChunk) {
  const client = new Anthropic({ apiKey })

  const stream = client.messages.stream({
    model: model || 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text)
    }
  }

  return await stream.finalMessage()
}

async function generateWithOpenAICompat(baseURL, apiKey, model, systemPrompt, messages, onChunk) {
  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const response = await axios({
    method: 'post',
    url: `${baseURL}/chat/completions`,
    data: { model, messages: allMessages, stream: true },
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    responseType: 'stream',
  })

  return new Promise((resolve, reject) => {
    let fullText = ''
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter((l) => l.trim())
      for (const line of lines) {
        if (line === 'data: [DONE]') continue
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const text = data.choices?.[0]?.delta?.content || ''
            if (text) {
              onChunk(text)
              fullText += text
            }
          } catch {}
        }
      }
    })
    response.data.on('end', () => resolve(fullText))
    response.data.on('error', reject)
  })
}

export async function generate(task, systemPrompt, messages, onChunk, overrideProvider = null) {
  const providerName = overrideProvider || getProviderForTask(task)
  let setting = getSettingForProvider(providerName)

  // Fallback to any enabled provider
  if (!setting) {
    setting = db.prepare('SELECT * FROM ai_settings WHERE enabled = 1 LIMIT 1').get()
    if (!setting) {
      throw new Error(
        'No AI provider configured. Please add an API key in Settings.'
      )
    }
  }

  if (setting.provider === 'Claude') {
    return generateWithClaude(setting.api_key, setting.model, systemPrompt, messages, onChunk)
  } else {
    const provider = PROVIDERS[setting.provider]
    return generateWithOpenAICompat(
      provider.baseURL,
      setting.api_key,
      setting.model,
      systemPrompt,
      messages,
      onChunk
    )
  }
}

export function getActiveProviderInfo() {
  const active = db.prepare(
    'SELECT provider, model FROM ai_settings WHERE is_active = 1'
  ).get()
  return active || null
}
