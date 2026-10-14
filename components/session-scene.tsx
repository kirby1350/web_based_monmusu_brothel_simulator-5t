'use client'

// 亲自上场的对话场景（阶段 2：整段搬自旧 service-screen，阶段 3 再改成步骤条）
import { useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle, Loader2, Send, ChevronRight } from 'lucide-react'
import { MonstGirl, Guest, ChatMessage, ServiceSession, AppSettings, Player } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatBar } from '@/components/stat-bar'
import { ChatEngine, ChatEngineHandle } from '@/components/chat-engine'
import { SuggestionBar } from '@/components/suggestion-bar'
import { buildServiceSystemPrompt, buildOpeningDialoguePrompt } from '@/lib/prompt-builder'
import {
  createServiceSession, applyStatDelta, estimateStatDelta, parseStatsFromReply, getGirlDelta,
  updateGuestSatisfaction, parseActionsFromReply, computeInitialSatisfaction,
} from '@/lib/game-engine'
import { parseLooseJson } from '@/lib/utils'

export interface SceneOutcome {
  turnCount: number
  messages: ChatMessage[]
}

interface SessionSceneProps {
  player: Player
  girl: MonstGirl
  guest: Guest
  settings: AppSettings
  onFinish: (outcome: SceneOutcome) => void
}

export function SessionScene({ player, girl, guest, settings, onFinish }: SessionSceneProps) {
  const [phase, setPhase] = useState<'opening' | 'active'>('opening')
  const [session, setSession] = useState<ServiceSession>(() =>
    createServiceSession('service', [girl], { guest: { ...guest, satisfaction: computeInitialSatisfaction(guest, [girl]) } }))
  const [suggestions, setSuggestions] = useState<[string, string, string] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [openingText, setOpeningText] = useState('')
  const [openingLoading, setOpeningLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const chatRef = useRef<ChatEngineHandle>(null)

  // ─── 开场（场景描述 + 初始推荐行动） ───────────────────────────────────────
  useEffect(() => {
    let ignore = false
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const fallback = '客人踏入了包间……'
    const scene = (async () => {
      try {
        const prompt = buildOpeningDialoguePrompt('service', player, [girl], { guest })
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
        })
        return res.ok ? ((await res.json()).content ?? '').trim() || fallback : fallback
      } catch { return fallback }
    })()
    const sugs = (async () => {
      const sugPrompt = `为以下服务场景生成3个玩家可选的开场行动指令。\n魔物娘：${girl.name}（${girl.race}），性格：${girl.personality}，服从度：${girl.obedience}/100，淫乱度：${girl.lewdness}/100，客人需求：${guest.desires}\n\n要求：\n- 行动1：玩家/客人主动发起，5-12字\n- 行动2：双方互动，5-12字\n- 行动3：魔物娘主动发起，5-12字\n- 贴合角色性格与服从度\n- 只输出JSON数组：["行动1","行动2","行动3"]`
      try {
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: sugPrompt }], model: settings.chatModel, apiKey, stream: false }),
        })
        if (!res.ok) return null
        const text = ((await res.json()).content ?? '').trim()
        const match = text.match(/[[［][\s\S]*?[\]］]/)
        const arr = match ? parseLooseJson<string[]>(match[0]) : null
        return Array.isArray(arr) && arr.length >= 3 ? [arr[0], arr[1], arr[2]] as [string, string, string] : null
      } catch { return null }
    })()
    Promise.all([scene, sugs]).then(([t, s]) => {
      if (ignore) return
      setOpeningText(t)
      setOpeningLoading(false)
      if (s) setSuggestions(s)
    })
    return () => { ignore = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 回复解析：STATS 只驱动会话内快感/推荐行动，最终满意度以结算函数为准 ───
  const handleRawReply = useCallback((raw: string) => {
    const actions = parseActionsFromReply(raw)
    if (actions) setSuggestions(actions)
    else setSuggestions((prev) => prev ?? ['继续当前行动', '加深刺激力度', '改变姿势角度'])
    const multi = parseStatsFromReply(raw)
    const fallback = multi ? null : estimateStatDelta(raw)
    setSession((prev) => {
      const girlsStats = { ...prev.girlsStats }
      const delta = multi ? (getGirlDelta(multi, girl.name) ?? { pleasureDelta: 5, staminaDelta: -8 }) : fallback!
      girlsStats[girl.id] = applyStatDelta(girlsStats[girl.id], delta)
      return {
        ...prev,
        girlsStats,
        guestStats: prev.guestStats ? applyStatDelta(prev.guestStats, delta) : undefined,
        guest: prev.guest ? updateGuestSatisfaction(prev.guest, delta.pleasureDelta, multi?.satisfactionDelta) : undefined,
      }
    })
  }, [girl.id, girl.name])

  const finish = () => onFinish({ turnCount: messages.filter((m) => m.role === 'user').length, messages })
  const systemPrompt = buildServiceSystemPrompt(player, { ...session, messages }, settings.proseStyle)
  const stats = session.girlsStats[girl.id]

  if (phase === 'opening') {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto w-full">
        <h2 className="text-base font-bold gold-text">迎接客人</h2>
        <div className="bg-card border border-border rounded-xl p-5 w-full min-h-[80px] flex items-center justify-center">
          {openingLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /><span>描述场景中…</span></div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90 text-center">{openingText}</p>
          )}
        </div>
        <Button className="h-10 px-8 glow-btn gap-2" disabled={openingLoading} onClick={() => {
          const seedMeta = `\n<!--STATS:${JSON.stringify({ girls: { [girl.name]: { pleasure: 0, stamina: 0 } }, satisfaction: 0 })}-->` +
            `\n<!--ACTIONS:["主动上前回应","与她贴身调情","她搂住你索吻"]-->`
          setMessages(openingText ? [{ role: 'assistant', content: openingText + seedMeta }] : [])
          setPhase('active')
        }}>
          继续 <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="w-48 border-r border-border flex flex-col overflow-y-auto shrink-0">
        <div className="p-3 space-y-3">
          <div className="bg-secondary/20 rounded-lg overflow-hidden">
            {girl.imageUrl && (
              <div className="w-full aspect-[3/2] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={girl.imageUrl} alt={girl.name} className="w-full h-full object-cover object-top" />
              </div>
            )}
            <div className="p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold gold-text">{girl.name}</span>
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{girl.race}</Badge>
              </div>
              {stats && (
                <>
                  <StatBar label="快感" value={stats.pleasure} color="pink" size="sm" />
                  <StatBar label="体力" value={stats.stamina} color="blue" size="sm" />
                </>
              )}
            </div>
          </div>
          {session.guest && session.guestStats && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-400">{session.guest.name}</span>
                <Badge variant="secondary" className="text-[8px] h-3.5 px-1">客</Badge>
              </div>
              <StatBar label="快感" value={session.guestStats.pleasure} color="gold" size="sm" />
              <StatBar label="体力" value={session.guestStats.stamina} color="green" size="sm" />
            </div>
          )}
        </div>
        <div className="mt-auto p-3 border-t border-border">
          <Button variant="outline" size="sm" className="w-full h-9 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10" onClick={finish}>
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />结束服务
          </Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <ChatEngine ref={chatRef} systemPrompt={systemPrompt} messages={messages} onMessagesChange={setMessages}
          settings={settings} onRawStreamComplete={handleRawReply} showInput={false} className="flex-1 min-h-0" />
        <SuggestionBar suggestions={suggestions} onSelect={(t) => setInputValue(t)} />
        <div className="border-t border-border px-3 pb-3 pt-2 flex gap-2 items-end">
          <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 min-h-[56px] max-h-[100px] resize-none bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="描述你的行动…（Enter 发送，Shift+Enter 换行）"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (inputValue.trim()) { chatRef.current?.sendMessage(inputValue.trim()); setInputValue('') }
              }
            }} />
          <Button size="icon" className="h-9 w-9 shrink-0 glow-btn" disabled={!inputValue.trim()}
            onClick={() => { chatRef.current?.sendMessage(inputValue.trim()); setInputValue('') }}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
