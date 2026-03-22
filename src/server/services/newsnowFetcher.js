import axios from 'axios'

const NEWSNOW_API = 'https://newsnow.busiyii.world/api/s'

export const PLATFORMS = {
  zhihu: '知乎热榜',
  weibo: '微博热搜',
  bilibili: 'B站热门',
  baidu: '百度热搜',
  douyin: '抖音热榜',
  toutiao: '今日头条',
  tieba: '贴吧热议',
  thepaper: '澎湃新闻',
  ifeng: '凤凰资讯',
  wallstreetcn: '华尔街见闻',
  cls: '财联社',
}

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Referer: 'https://newsnow.busiyii.world/',
  Accept: 'application/json',
}

/**
 * Fetch trending items from a single platform via the NewsNow API.
 * Returns an array of { source, source_name, title, url } objects.
 */
export async function fetchPlatform(platformId) {
  const res = await axios.get(NEWSNOW_API, {
    params: { id: platformId },
    timeout: 12000,
    headers: REQUEST_HEADERS,
  })

  const items = res.data?.items
  if (!Array.isArray(items)) return []

  return items
    .map((item) => ({
      source: platformId,
      source_name: PLATFORMS[platformId] || platformId,
      title: (item.title || '').trim(),
      url: item.url || item.mobileUrl || '',
    }))
    .filter((item) => item.title && item.url)
}

/**
 * Fetch trending items from multiple platforms sequentially.
 * Failed platforms are skipped (warning logged).
 * Returns a combined array of items.
 */
export async function fetchAllPlatforms(platformIds) {
  const results = []
  for (const id of platformIds) {
    try {
      const items = await fetchPlatform(id)
      results.push(...items)
    } catch (err) {
      console.warn(`[newsnow] Failed to fetch "${id}": ${err.message}`)
    }
  }
  return results
}
