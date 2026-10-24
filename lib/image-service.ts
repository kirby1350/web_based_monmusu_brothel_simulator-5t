import { AppSettings, IMAGE_MODELS, IMAGE_STYLES, TENSORART_MODELS } from '@/lib/types'
import { withQualityPrefix } from '@/lib/image-prompts'

export interface GenerateImageResult {
  url: string
  error?: string
}

const POLL_INTERVAL = 2000
const MAX_POLLS = 30

/**
 * 通过 PixAI API 生成图片并等待结果
 */
async function generatePixAI(
  tags: string,
  settings: AppSettings
): Promise<GenerateImageResult> {
  const modelId = IMAGE_MODELS[settings.imageModel]?.modelId
  const styleTags = IMAGE_STYLES[settings.imageStyle]?.tags ?? ''
  const customTags = settings.imageStyleCustom ?? ''
  // 拼接顺序：画师 → 质量 → 角色/外观/身材/服装/状态 → 自定义
  const fullTags = [styleTags, withQualityPrefix(tags), customTags].filter(Boolean).join(', ')

  const res = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // route expects "prompts" not "prompt"
    body: JSON.stringify({ prompts: fullTags, modelId, apiKey: settings.pixaiApiKey }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { url: '', error: err }
  }

  const createData = await res.json()
  // PixAI returns { id: "...", status: "waiting", outputs: { mediaUrls: [] } }
  const taskId = createData?.id

  if (!taskId) {
    return { url: '', error: `无法获取 taskId，响应: ${JSON.stringify(createData)}` }
  }

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    const pollRes = await fetch(`/api/image/task/${taskId}`, {
      headers: { 'x-pixai-key': settings.pixaiApiKey },
    })
    if (!pollRes.ok) continue
    const data = await pollRes.json()
    // PixAI poll: { status: "completed", outputs: { mediaUrls: ["https://..."] } }
    const status = data?.status
    const url = data?.outputs?.mediaUrls?.[0]
    if (status === 'completed' && url) {
      return { url }
    }
    if (status === 'failed') {
      return { url: '', error: 'Task failed' }
    }
  }

  return { url: '', error: 'Timeout' }
}

/**
 * 从 TensorArt 轮询结果里取第一张图的 URL。
 * 现行格式：{ job: { status: "SUCCESS", successInfo: { images: [{ url }] } } }；
 * 旧格式：{ job: { images: [{ url }] } }（兜底）。
 */
export function tensorArtImageUrl(job: unknown): string | undefined {
  const j = job as { successInfo?: { images?: { url?: unknown }[] }; images?: { url?: unknown }[] } | null | undefined
  for (const list of [j?.successInfo?.images, j?.images]) {
    const url = Array.isArray(list) ? list.find((im) => typeof im?.url === 'string' && im.url)?.url : undefined
    if (typeof url === 'string') return url
  }
  return undefined
}

/**
 * 通过 TensorArt API 生成图片并等待结果
 */
async function generateTensorArt(
  tags: string,
  settings: AppSettings
): Promise<GenerateImageResult> {
  const modelId = TENSORART_MODELS[settings.tensorartModel]?.modelId
  const styleTags = IMAGE_STYLES[settings.imageStyle]?.tags ?? ''
  const customTags = settings.imageStyleCustom ?? ''
  // 拼接顺序：画师 → 质量 → 角色/外观/身材/服装/状态 → 自定义
  const fullTags = [styleTags, withQualityPrefix(tags), customTags].filter(Boolean).join(', ')

  const res = await fetch('/api/image/tensorart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompts: fullTags, modelId, apiKey: settings.tensorartApiKey }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { url: '', error: err }
  }

  const createData = await res.json()
  // TensorArt returns { job: { id: "...", status: "CREATED" } }
  const jobId = createData?.job?.id

  if (!jobId) {
    return { url: '', error: `无法获取 jobId，响应: ${JSON.stringify(createData)}` }
  }

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    const pollRes = await fetch(`/api/image/tensorart/${jobId}`, {
      headers: { 'x-tensorart-key': settings.tensorartApiKey },
    })
    if (!pollRes.ok) continue
    const data = await pollRes.json()
    const job = data?.job
    const status = job?.status
    const url = tensorArtImageUrl(job)
    if ((status === 'SUCCESS' || status === 'COMPLETED') && url) {
      return { url }
    }
    if (status === 'FAILED' || status === 'ERROR') {
      return { url: '', error: 'Task failed' }
    }
  }

  return { url: '', error: 'Timeout' }
}

// 本次页面会话中已鉴权失败（缺 Key / 401 / 403）的服务商：之后不再自动生图，避免每次进页面都打一个注定失败的请求
const authFailed = new Set<string>()
export function imageAuthFailed(provider: string): boolean { return authFailed.has(provider) }
export function markImageAuthFailed(provider: string): void { authFailed.add(provider) }
export function resetImageAuthFailed(): void { authFailed.clear() }

/** 把路由返回的错误（常是 JSON 文本）转成一句短提示；auth=true 表示缺 Key 或鉴权失败 */
export function friendlyImageError(raw: string | undefined): { text: string; auth: boolean } {
  let msg = raw ?? ''
  try { const j = JSON.parse(msg); if (j && typeof j.error === 'string') msg = j.error } catch { /* 非 JSON，原样用 */ }
  const auth = /未配置.*Key|unauthori[sz]ed|\b40[13]\b|invalid.*(key|token)|app not found/i.test(msg)
  if (auth) return { text: '生图未配置或 Key 无效（设置 → 生图）', auth: true }
  if (!msg) return { text: '生成失败', auth: false }
  return { text: msg.length > 60 ? msg.slice(0, 60) + '…' : msg, auth: false }
}

/**
 * 统一图片生成入口 — 根据 settings.imageProvider 自动路由
 */
export async function generateImage(
  tags: string,
  settings: AppSettings
): Promise<GenerateImageResult> {
  if (settings.imageProvider === 'tensorart') {
    return generateTensorArt(tags, settings)
  }
  return generatePixAI(tags, settings)
}

/**
 * 通过 /api/chat 生成 TAG（单次非流式调用）
 */
export async function generateTagsViaChat(
  prompt: string,
  settings: AppSettings
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      model: settings.chatModel,
      apiKey: settings.chatApiKey,
      stream: false,
    }),
  })
  if (!res.ok) return ''
  const data = await res.json()
  return data.content ?? data.text ?? ''
}
