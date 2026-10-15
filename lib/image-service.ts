import { AppSettings, IMAGE_MODELS, IMAGE_STYLES, TENSORART_MODELS } from '@/lib/types'

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
  const fullTags = [tags, styleTags, customTags].filter(Boolean).join(', ')

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
  const fullTags = [tags, styleTags, customTags].filter(Boolean).join(', ')

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
