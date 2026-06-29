import { NextRequest, NextResponse } from 'next/server'
import { CHAT_MODELS } from '@/lib/types'
import { parseSseToContent } from '@/lib/sse'

export const runtime = 'edge'

const CHAT_TEMPERATURE = 0.9
// 给得宽裕：丰富的正文 + 末尾的 STATS/ACTIONS 结构化 JSON 必须都能放下，
// 否则结构化尾块会被截断，导致 game-engine 无法解析数值。
const CHAT_MAX_TOKENS = 4096
const DEFAULT_CHAT_MODEL = 'Apex-Neo-0213-16k'
const DEFAULT_GROK_MODEL = 'grok-4-latest'
const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions'
const DZMM_ENDPOINT = 'https://www.gpt4novel.com/api/xiaoshuoai/ext/v1/chat/completions'
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

export async function POST(req: NextRequest) {
  const { messages, model, apiKey, grokApiKey, stream: streamMode = true } = await req.json()

  const modelMeta = CHAT_MODELS.find((m) => m.value === model)
  const isGrok = modelMeta?.provider === 'grok'

  if (isGrok) {
    const key = grokApiKey || process.env.GROK_API_KEY
    if (!key) {
      return NextResponse.json({ error: '未配置 Grok API Key' }, { status: 401 })
    }
    try {
      const response = await fetch(GROK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || DEFAULT_GROK_MODEL,
          messages,
          stream: streamMode,
          temperature: CHAT_TEMPERATURE,
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        return NextResponse.json({ error: `Grok API 错误: ${err}` }, { status: response.status })
      }
      if (!streamMode) {
        const raw = await response.text()
        const content = parseSseToContent(raw)
        return NextResponse.json({ content })
      }
      return new NextResponse(response.body, { headers: SSE_HEADERS })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  // Default: gpt4novel provider
  const key = apiKey || process.env.CHAT_API_KEY
  if (!key) {
    return NextResponse.json({ error: '未配置 Chat API Key' }, { status: 401 })
  }

  try {
    const response = await fetch(DZMM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_CHAT_MODEL,
        messages,
        stream: true, // 始终向上游请求流式；非流式调用方由 parseSseToContent 拼回整段
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `API 错误: ${err}` }, { status: response.status })
    }

    if (!streamMode) {
      // 上游始终返回 SSE；读取完整 body 并抽取 content
      const raw = await response.text()
      const content = parseSseToContent(raw)
      return NextResponse.json({ content })
    }

    return new NextResponse(response.body, { headers: SSE_HEADERS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
