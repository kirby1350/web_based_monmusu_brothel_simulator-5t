'use client'

// 亲自上场的对话场景（阶段 2：整段搬自旧 service-screen，阶段 3 再改成步骤条）
import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Send, ChevronRight, Shirt, Plus, Check } from 'lucide-react'
import { MonstGirl, Guest, ChatMessage, ServiceSession, AppSettings, Player, OutfitId, StockingId } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChatEngine, ChatEngineHandle } from '@/components/chat-engine'
import { SuggestionBar } from '@/components/suggestion-bar'
import { getStepActions } from '@/lib/custom-props'
import { buildServiceSystemPrompt, buildOpeningDialoguePrompt, buildBehaviourLines, stepBehaviour } from '@/lib/prompt-builder'
import {
  createServiceSession, applyStatDelta, estimateStatDelta, parseStatsFromReply, getGirlDelta,
  updateGuestSatisfaction, parseActionsFromReply, computeInitialSatisfaction,
} from '@/lib/game-engine'
import { parseLooseJson, cn } from '@/lib/utils'
import { OUTFITS, STOCKINGS, getSensitivityLevel } from '@/lib/catalog'
import { SERVICE_STEPS } from '@/lib/resolve-service'
import {
  initLiveState, recordTurn, nextStep, canChangeOutfit, changeOutfit, insertablePlays, insertPlay,
  resolveLiveSteps, buildStepContext, type LiveState,
} from '@/lib/live-steps'
import type { ServicePlan } from '@/components/session-setup'

export interface SceneOutcome {
  state: LiveState
  messages: ChatMessage[]
}

interface SessionSceneProps {
  player: Player
  plan: ServicePlan
  wardrobe: string[]
  settings: AppSettings
  onFinish: (outcome: SceneOutcome) => void
}

export function SessionScene({ player, plan, wardrobe, settings, onFinish }: SessionSceneProps) {
  const { girl, guest } = plan
  const [live, setLive] = useState<LiveState>(() => initLiveState(plan))
  const [panel, setPanel] = useState<'none' | 'outfit' | 'play'>('none')
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

  const finish = (state: LiveState) => onFinish({ state, messages })
  const stepDef = SERVICE_STEPS[live.stepIndex]
  const stepActions = getStepActions(player, girl)
  const preview = resolveLiveSteps(plan, live)
  const currentStep = preview.steps[live.stepIndex]
  const zoneVal = currentStep.zone ? girl.sensitivities?.[currentStep.zone] : undefined
  const outfitName = `${OUTFITS.find((o) => o.id === live.outfit)?.name ?? '常服'}${live.stockings !== 'none' ? ' + ' + STOCKINGS.find((x) => x.id === live.stockings)?.name : ''}`
  const stepContext = buildStepContext({
    stepLabel: stepDef.label,
    standardAction: stepActions[live.stepIndex],
    outfitName,
    zoneLabel: currentStep.zone,
    zoneLevel: zoneVal !== undefined ? getSensitivityLevel(zoneVal) : undefined,
    plays: preview.plays.map((p) => p.name),
  })
  const behaviour = buildBehaviourLines(girl.name, stepBehaviour(girl, live.stepIndex, currentStep.zone, currentStep.note, preview.plays.map((p) => p.id)))
  const systemPrompt = buildServiceSystemPrompt(player, { ...session, messages }, settings.proseStyle, behaviour ? `${stepContext}\n${behaviour}` : stepContext)
  const shownSuggestions: [string, string, string] = [stepActions[live.stepIndex], suggestions?.[1] ?? '与她贴身调情', suggestions?.[2] ?? '她主动靠近']
  const owned = new Set(wardrobe)
  const outfitOpts = OUTFITS.filter((o) => o.id === 'regular' || owned.has(o.id))
  const stockingOpts = STOCKINGS.filter((x) => x.id === 'none' || owned.has(x.id))
  const playOpts = insertablePlays(plan, live)
  const send = (text: string) => {
    if (!text.trim() || live.finished) return
    setLive((s) => recordTurn(s))
    chatRef.current?.sendMessage(text.trim())
    setInputValue('')
  }
  const goNext = () => {
    const n = nextStep(live)
    setPanel('none')
    if (n.finished) finish(n)
    else setLive(n)
  }

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
    <div className="flex flex-col flex-1 min-h-0">
      {/* 顶部步骤条 */}
      <div className="border-b border-border px-3 pt-2 pb-1.5 shrink-0 space-y-1.5" data-testid="step-bar">
        <div className="flex gap-1">
          {SERVICE_STEPS.map((st, i) => (
            <div key={st.key} data-testid={`step-${st.key}`} data-state={i < live.stepIndex ? 'done' : i === live.stepIndex ? 'current' : 'todo'}
              className={cn('flex-1 rounded-md border px-1 py-1 text-center text-xs transition-colors',
                i === live.stepIndex ? 'border-amber-400/70 text-amber-300 bg-amber-400/10 font-semibold'
                  : i < live.stepIndex ? 'border-border text-foreground/85 bg-secondary/40' : 'border-border text-foreground/60 bg-secondary/10')}>
              {i < live.stepIndex && <Check className="w-3 h-3 inline mr-0.5" />}{st.label}
              <span className="block text-[11px] tabular-nums opacity-90">{i <= live.stepIndex ? preview.steps[i].score : '–'}/14</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-foreground/75 flex-wrap">
          <span data-testid="live-stamina">体力 {Math.max(0, (girl.stamina ?? 100) - preview.staminaCost)}（−{preview.staminaCost}）</span>
          <span data-testid="live-satisfaction">满意度 {preview.satisfaction}（{preview.tier.label}）</span>
          <span data-testid="live-outfit">服装 {outfitName}</span>
          <span className="flex-1" />
          <button className="underline hover:text-rose-400" onClick={() => finish(live)}>提前结束</button>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs glow-btn" data-testid="btn-next-step"
            onClick={(e) => {
              // 只认鼠标/触摸点击：焦点留在按钮上时，键盘的 Enter/空格不会误推进步骤
              if (e.detail === 0) return
              e.currentTarget.blur()
              goNext()
            }}>
            {live.stepIndex === SERVICE_STEPS.length - 1 ? '结束服务' : '下一步'}<ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
          {playOpts.length > 0 && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setPanel(panel === 'play' ? 'none' : 'play')} data-testid="btn-insert-play">
              <Plus className="w-3.5 h-3.5 mr-0.5" />插入 play
            </Button>
          )}
          {canChangeOutfit(live) && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setPanel(panel === 'outfit' ? 'none' : 'outfit')} data-testid="btn-change-outfit">
              <Shirt className="w-3.5 h-3.5 mr-0.5" />换装（体力 −5）
            </Button>
          )}
        </div>
        {panel === 'play' && (
          <div className="flex flex-wrap gap-1.5">
            {playOpts.map((p) => (
              <button key={p.id} className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:border-amber-400/60"
                onClick={() => { setLive((s) => insertPlay(plan, s, p.id)); setPanel('none') }}>{p.source === 'race' ? '种族特技' : p.name}</button>
            ))}
          </div>
        )}
        {panel === 'outfit' && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {outfitOpts.flatMap((o) => stockingOpts.map((x) => ({ o, x }))).filter(({ o, x }) => o.id !== live.outfit || x.id !== live.stockings).map(({ o, x }) => (
              <button key={o.id + x.id} className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:border-amber-400/60"
                onClick={() => { setLive((s) => changeOutfit(s, o.id as OutfitId, x.id as StockingId)); setPanel('none') }}>
                {o.name}{x.id !== 'none' ? ' + ' + x.name : ''}{guest.prefOutfit && (o.pref === guest.prefOutfit || x.pref === guest.prefOutfit) ? ' · 对口' : ''}
              </button>
            ))}
            {outfitOpts.length === 1 && stockingOpts.length === 1 && <span className="text-[10px] text-muted-foreground">衣橱里只有常服，没有可换的衣服</span>}
          </div>
        )}
      </div>

      {/* 对话区 */}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatEngine ref={chatRef} systemPrompt={systemPrompt} messages={messages} onMessagesChange={setMessages}
          settings={settings} onRawStreamComplete={handleRawReply} showInput={false} className="flex-1 min-h-0" />
        <SuggestionBar suggestions={shownSuggestions} onSelect={(t) => setInputValue(t)} />
        <div className="border-t border-border px-3 pb-3 pt-2 flex gap-2 items-end">
          <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} data-testid="scene-input"
            className="flex-1 min-h-[56px] max-h-[100px] resize-none bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={`「${stepDef.label}」：描述你的行动…（Enter 发送）`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputValue) }
            }} />
          <Button size="icon" className="h-9 w-9 shrink-0 glow-btn" disabled={!inputValue.trim()} onClick={() => send(inputValue)} data-testid="scene-send">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── 调教的亲自上场（仍用旧调教提示词，无步骤条） ──────────────────────────────

export function TrainingScene({ player, girl, directionLabel, settings, onFinish }: {
  player: Player
  girl: MonstGirl
  directionLabel: string
  settings: AppSettings
  onFinish: (turns: number, pleasure: number) => void
}) {
  const [session] = useState<ServiceSession>(() => createServiceSession('training', [girl], {}))
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    role: 'assistant',
    content: `调教室的门缓缓关上。${girl.name}被带到你面前，今天的项目是「${directionLabel}」。` +
      `\n<!--STATS:${JSON.stringify({ girls: { [girl.name]: { pleasure: 0, stamina: 0 } }, satisfaction: 0 })}-->` +
      `\n<!--ACTIONS:["命令她跪下","抬起她的下巴","她低声求饶"]-->`,
  }])
  const [turns, setTurns] = useState(0)
  const [pleasure, setPleasure] = useState(0)
  const [suggestions, setSuggestions] = useState<[string, string, string] | null>(['命令她跪下', '抬起她的下巴', '她低声求饶'])
  const [inputValue, setInputValue] = useState('')
  const chatRef = useRef<ChatEngineHandle>(null)
  const systemPrompt = buildServiceSystemPrompt(player, { ...session, messages }, settings.proseStyle) + `\n\n【本次调教方向】${directionLabel}`

  const onRaw = useCallback((raw: string) => {
    const a = parseActionsFromReply(raw)
    if (a) setSuggestions(a)
    const multi = parseStatsFromReply(raw)
    const d = multi ? (getGirlDelta(multi, girl.name) ?? { pleasureDelta: 5, staminaDelta: -8 }) : estimateStatDelta(raw)
    setPleasure((p) => Math.max(0, Math.min(100, p + d.pleasureDelta)))
  }, [girl.name])
  const send = (t: string) => {
    if (!t.trim()) return
    setTurns((n) => n + 1)
    chatRef.current?.sendMessage(t.trim())
    setInputValue('')
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-border px-3 py-2 flex items-center gap-3 text-[11px] text-foreground/75 shrink-0">
        <span className="gold-text font-semibold">{girl.name}</span>
        <span>{directionLabel}</span>
        <span data-testid="tr-turns">回合 {turns}</span>
        <span>快感 {pleasure}</span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs border-rose-500/30 text-rose-400" onClick={() => onFinish(turns, pleasure)} data-testid="btn-end-training">
          结束调教
        </Button>
      </div>
      <ChatEngine ref={chatRef} systemPrompt={systemPrompt} messages={messages} onMessagesChange={setMessages}
        settings={settings} onRawStreamComplete={onRaw} showInput={false} className="flex-1 min-h-0" />
      <SuggestionBar suggestions={suggestions} onSelect={(t) => setInputValue(t)} />
      <div className="border-t border-border px-3 pb-3 pt-2 flex gap-2 items-end">
        <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 min-h-[56px] max-h-[100px] resize-none bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="描述你的调教…（Enter 发送）"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputValue) } }} />
        <Button size="icon" className="h-9 w-9 shrink-0 glow-btn" disabled={!inputValue.trim()} onClick={() => send(inputValue)}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

