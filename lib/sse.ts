// 解析 OpenAI 风格的 SSE chat-completion 流。
//
// 网络分块不会与 SSE 行边界对齐 —— 单个 `data: {...}` 行可能被拆到两次 read。
// 这里跨 chunk 缓冲，只在拿到完整行时才交付，保证不丢 token、不会把半行 JSON 喂坏。
export async function streamChatDeltas(
  response: Response,
  onDelta: (content: string) => void,
): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleLine = (raw: string) => {
    const line = raw.trim()
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    try {
      const parsed = JSON.parse(data)
      // 兼容上游 delta（流式）与 message（部分非流式实现）以及代理回传的 { content }
      const delta =
        parsed.choices?.[0]?.delta?.content ??
        parsed.choices?.[0]?.message?.content ??
        parsed.content
      if (delta) onDelta(delta)
    } catch {
      // keep-alive / 非 JSON 行 —— 安全忽略
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      handleLine(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
    }
  }
  // flush 末尾没有换行符就结束的那一行
  buffer += decoder.decode()
  if (buffer) handleLine(buffer)
}

/**
 * 把一整段 SSE 文本（非流式调用方读取完整 body 后）拼成一个 content 字符串。
 * 同时兼容上游直接返回 JSON 对象的情况。
 */
export function parseSseToContent(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      return parsed.choices?.[0]?.message?.content ?? parsed.choices?.[0]?.delta?.content ?? ''
    } catch {
      // 落到下面的 SSE 解析
    }
  }

  let content = ''
  for (const line of raw.split('\n')) {
    const stripped = line.trim()
    if (!stripped.startsWith('data:')) continue
    const data = stripped.slice(5).trim()
    if (data === '[DONE]') break
    try {
      const chunk = JSON.parse(data)
      content += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? ''
    } catch {
      // 跳过损坏行
    }
  }
  return content
}
