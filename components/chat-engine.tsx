'use client'

import { trimHistory, withTurnSuffix } from '@/lib/prompt-context'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChatMessage, AppSettings } from '@/lib/types'
import { stripStatsBlock } from '@/lib/game-engine'
import { streamChatDeltas } from '@/lib/sse'
import { cn } from '@/lib/utils'

export interface SendOpts {
  /** 隐藏的指令消息（自动转场）：界面显示 label 分隔线 */
  hidden?: boolean
  label?: string
  /** 请求失败时代替错误提示的本地回复 */
  fallback?: string
}
export interface ChatEngineHandle {
  sendMessage: (content: string, opts?: SendOpts) => Promise<void>
  /** 正在等模型回复 */
  isBusy: () => boolean
}

interface ChatEngineProps {
  systemPrompt: string
  /** 历史被裁剪时用来替代旧轮次的一行前情（缺省按玩家原话拼） */
  recap?: string
  messages: ChatMessage[]
  onMessagesChange: (msgs: ChatMessage[]) => void
  settings: AppSettings
  onAssistantReply?: (content: string) => void
  onStreamComplete?: (fullContent: string) => void
  onRawStreamComplete?: (rawContent: string) => void  // raw text including <!--STATS:...-->
  disabled?: boolean
  placeholder?: string
  className?: string
  showInput?: boolean
  /** 在玩家消息上显示「让她记住」；点了把这句原话交给调用方 */
  onRememberUser?: (text: string) => void
  /** 只附在本次请求最后一条玩家消息末尾的提醒（字数等），不进界面与存档 */
  turnSuffix?: string
}

export const ChatEngine = forwardRef<ChatEngineHandle, ChatEngineProps>(
  function ChatEngine(
    {
      systemPrompt,
      recap,
      messages,
      onMessagesChange,
      settings,
      onAssistantReply,
      onStreamComplete,
      onRawStreamComplete,
      disabled = false,
      placeholder = '输入你的行动…',
      className,
      showInput = true,
      onRememberUser,
      turnSuffix,
    },
    ref
  ) {
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [streamingText, setStreamingText] = useState('')
    const bottomRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingText])

    const sendMessage = useCallback(
      async (content: string, opts?: SendOpts) => {
        if (!content.trim() || streaming) return

        const userMsg: ChatMessage = { role: 'user', content: content.trim(), ...(opts?.hidden ? { hidden: true, label: opts.label } : {}) }
        const next = [...messages, userMsg]
        onMessagesChange(next)
        setInput('')
        setStreaming(true)
        setStreamingText('')

        const controller = new AbortController()
        abortRef.current = controller

        // 90 秒自动中止，防止界面卡死（300–500 字的长回复要多留时间）
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, 90_000)

        // 声明在 try 之外，catch（中止/超时）也需要读取已接收的内容
        let full = ''

        try {
          const provider = settings.chatModel.startsWith('grok') ? 'grok' : 'default'
          const apiKey =
            provider === 'grok' ? settings.grokApiKey : settings.chatApiKey

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                // 只改发送内容：旧回复去掉隐藏数据块、保留最近 6 轮（界面与存档里的历史不变）
                ...withTurnSuffix(trimHistory(next, 6, recap), turnSuffix).map(({ role, content }) => ({ role, content })),
              ],
              model: settings.chatModel,
              apiKey,
              stream: true,
            }),
          })

          if (!res.ok || !res.body) {
            throw new Error(`HTTP ${res.status}`)
          }

          await streamChatDeltas(res, (delta) => {
            full += delta
            const cleanFull = stripStatsBlock(full)
            setStreamingText(cleanFull)
            onAssistantReply?.(cleanFull)
          })

          if (full) {
            clearTimeout(timeoutId)
            const clean = stripStatsBlock(full)
            // 存【原始】回复（含 STATS/ACTIONS 块）进历史——这样回传给模型的对话里
            // 每条助手消息都带数据块，格式一致，模型才会持续输出；显示时由渲染层 stripStatsBlock 隐藏。
            const assistantMsg: ChatMessage = { role: 'assistant', content: full }
            onMessagesChange([...next, assistantMsg])
            onStreamComplete?.(clean)
            onRawStreamComplete?.(full)  // raw contains <!--STATS:...-->
          } else if (opts?.fallback) {
            onMessagesChange([...next, { role: 'assistant', content: opts.fallback }])
            onRawStreamComplete?.('')
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId)
          if ((err as Error)?.name === 'AbortError') {
            // Timeout or manual abort — show what we got so far, or an error message
            if (full) {
              const clean = stripStatsBlock(full)
              const assistantMsg: ChatMessage = { role: 'assistant', content: clean + '\n\n[回复已中断]' }
              onMessagesChange([...next, assistantMsg])
              onStreamComplete?.(clean)
              onRawStreamComplete?.(full)
            } else if (opts?.fallback) {
              onMessagesChange([...next, { role: 'assistant', content: opts.fallback }])
              onRawStreamComplete?.('')
            } else {
              const errMsg: ChatMessage = { role: 'assistant', content: '[请求超时或已中断，请重试]' }
              onMessagesChange([...next, errMsg])
              // Ensure raw callback fires even on empty abort so callers can reset their state
              onRawStreamComplete?.('')
            }
          } else {
            const errMsg: ChatMessage = {
              role: 'assistant',
              content: opts?.fallback ?? '[连接失败，请检查 API 设置]',
            }
            onMessagesChange([...next, errMsg])
            onRawStreamComplete?.('')
          }
        } finally {
          clearTimeout(timeoutId)
          setStreaming(false)
          setStreamingText('')
          abortRef.current = null
        }
      },
      [messages, streaming, systemPrompt, recap, turnSuffix, settings, onMessagesChange, onAssistantReply, onStreamComplete]
    )

    useImperativeHandle(ref, () => ({ sendMessage, isBusy: () => streaming }))

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    }

    const stopStream = () => {
      abortRef.current?.abort()
    }

    const allMessages = streaming
      ? [...messages, { role: 'assistant' as const, content: streamingText }]
      : messages

    return (
      <div className={cn('flex flex-col h-full', className)}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {allMessages
            .filter((m) => m.role !== 'system')
            .map((msg, i) => msg.hidden ? (
              <div key={i} className="flex items-center gap-2 text-[10px] text-amber-300/70" data-testid="transition-divider">
                <span className="flex-1 h-px bg-amber-400/20" />{msg.label ?? '转场'}<span className="flex-1 h-px bg-amber-400/20" />
              </div>
            ) : (
              <div
                key={i}
                className={cn(
                  'rounded-lg px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'user' ? 'message-user ml-8' : 'message-ai mr-4'
                )}
              >
                {msg.role === 'user' && (
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center justify-between gap-2">
                    <span>你</span>
                    {onRememberUser && (
                      <button type="button" data-testid="remember-btn" className="text-[10px] text-emerald-300/80 hover:text-emerald-300"
                        onClick={() => onRememberUser(msg.content)}>让她记住</button>
                    )}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-foreground/90">
                  {msg.role === 'assistant' ? stripStatsBlock(msg.content) : msg.content}
                  {msg.role === 'assistant' && streaming && i === allMessages.filter((m) => m.role !== 'system').length - 1 && (
                    <span className="inline-block w-1 h-4 bg-primary/70 animate-pulse ml-0.5 align-middle" />
                  )}
                </p>
              </div>
            ))}
          {allMessages.filter((m) => m.role !== 'system').length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground/40 italic">故事即将展开…</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {showInput && (
          <div className="border-t border-border p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || streaming}
              className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-input text-sm"
              rows={2}
            />
            {streaming ? (
              <Button
                size="icon"
                variant="destructive"
                className="h-9 w-9 shrink-0"
                onClick={stopStream}
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 glow-btn"
                disabled={!input.trim() || disabled}
                onClick={() => sendMessage(input)}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
)
