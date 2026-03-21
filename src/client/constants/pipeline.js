export const STEPS = [
  { n: 1, label: 'Brief', icon: '📋' },
  { n: 2, label: '生成', icon: '✦' },
  { n: 3, label: '编辑', icon: '✍️' },
  { n: 4, label: '排版', icon: '🎨' },
  { n: 5, label: '导出', icon: '📤' },
]

export const CONTENT_FORMS = ['知识卡片', '步骤教程', '经验分享', '工具推荐']

export const PLATFORMS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '公众号' },
  { value: 'jike', label: '即刻' },
  { value: 'twitter', label: 'Twitter/X' },
]

export const DEFAULT_BRIEF = {
  platform: 'xiaohongshu',
  targetAudience: '',
  coreMessage: '',
  contentForm: '知识卡片',
  cardCount: 3,
}

export const DEFAULT_CARD_STYLE = {
  backgroundColor: '#1A1A2E',
  accentColor: '#4A9EFF',
  textColor: '#E8E8E8',
  fontSize: 28,
  padding: 60,
  showSignature: false,
  signature: '',
}
