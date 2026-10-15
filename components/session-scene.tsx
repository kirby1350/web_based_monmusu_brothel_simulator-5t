'use client'

// 亲自上场的对话场景（阶段 2：整段搬自旧 service-screen，阶段 3 再改成步骤条）
import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Send, ChevronRight, Shirt, Plus, Check } from 'lucide-react'
import { MonstGirl, Guest, ChatMessage, ServiceSession, AppSettings, Player, OutfitId, StockingId, SceneId, SensitivityZone, SkillKey } from '@/lib/types'
import { getScene, detectShadowTrigger } from '@/lib/scenes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChatEngine, ChatEngineHandle, type SendOpts } from '@/components/chat-engine'
import { SuggestionBar } from '@/components/suggestion-bar'
import { getStepActions } from '@/lib/custom-props'
import { stepActionsWithPlays } from '@/lib/service-flows'
import { buildServiceSystemPrompt, buildOpeningDialoguePrompt, buildSuggestionPrompt, type SuggestionCtx, buildBehaviourLines, stepBehaviour, buildTrainingOpeningPrompt } from '@/lib/prompt-builder'
import {
  createServiceSession, applyStatDelta, estimateStatDelta, parseStatsFromReply, getGirlDelta,
  parseActionsFromReply, computeInitialSatisfaction,
} from '@/lib/game-engine'
import { parseLooseJson, cn } from '@/lib/utils'
import { OUTFITS, STOCKINGS, STEP_MAX, getSensitivityLevel, playIconPath, ALL_PLAYS } from '@/lib/catalog'
import { buildStepRecap, provokeSection, lengthReminder, transitionTurn, transitionFallback, climaxSlipNote, shortReplyNote, extractMetaphors, pushRecent, recentUseLine } from '@/lib/prompt-context'
import { bankWordsUsed } from '@/lib/prose-bank'
import { ItemIcon } from '@/components/item-icon'
import { SERVICE_STEPS } from '@/lib/resolve-service'
import {
  initLiveState, recordTurn, nextStep, canChangeOutfit, changeOutfit, insertablePlays, insertPlay,
  resolveLiveSteps, buildStepContext, recordModelStats, topicHit, type LiveState,
} from '@/lib/live-steps'
import { heatPromptBlock, speechBand, initTrainingHeat, trainingHeatTurn, TRAINING_PHASE, type HeatState } from '@/lib/arousal'
import { HeatPanel } from '@/components/heat-panel'
import { GuestPrefs } from '@/components/guest-prefs'
import { applyPartners } from '@/lib/multi-service'
import { getMainService } from '@/lib/resolve-service'
import type { ServicePlan } from '@/components/session-setup'
import { speechLine } from '@/lib/speech-style'
import { buildCraftBlock, presetFlowRace, playStepOf, skillCraftLine } from '@/lib/play-prompts'
import { divisionBlock, partnerRole } from '@/lib/multi-prompts'

export interface SceneOutcome {
  state: LiveState
  messages: ChatMessage[]
}

interface SessionSceneProps {
  /** 玩家消息上的「让她记住」 */
  onRemember?: (text: string) => void
  player: Player
  plan: ServicePlan
  wardrobe: string[]
  settings: AppSettings
  onFinish: (outcome: SceneOutcome) => void
}

export function SessionScene({ player, plan, wardrobe, settings, onFinish, onRemember }: SessionSceneProps) {
  const { girl, guest } = plan
  // 多人服务：主位 + 协同，提示词/面板/STATS 都按全员
  const cast = [girl, ...(plan.partners ?? [])]
  const [live, setLive] = useState<LiveState>(() => initLiveState(plan))
  const [panel, setPanel] = useState<'none' | 'outfit' | 'play'>('none')
  // 下一回合附在玩家消息后的本地校正（高潮越界 / 篇幅过短）
  const [nextNote, setNextNote] = useState('')
  const [recentMetaphors, setRecentMetaphors] = useState<string[]>([])
  const [recentBank, setRecentBank] = useState<string[]>([])
  const liveRef = useRef(live)
  useEffect(() => { liveRef.current = live }, [live])
  // 现场插入的 play 记在插入时的那一步（写作素材只在那一步给）
  const [insertedAt, setInsertedAt] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<'opening' | 'active'>('opening')
  const [session, setSession] = useState<ServiceSession>(() =>
    createServiceSession('service', cast, { guest: { ...guest, satisfaction: computeInitialSatisfaction(guest, cast) } }))
  const [suggestions, setSuggestions] = useState<[string, string, string] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [openingText, setOpeningText] = useState('')
  const [openingLoading, setOpeningLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const chatRef = useRef<ChatEngineHandle>(null)
  const transitionRef = useRef(false)

  // ─── 开场（场景描述 + 初始推荐行动） ───────────────────────────────────────
  useEffect(() => {
    let ignore = false
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const fallback = '客人踏入了包间……'
    const scene = (async () => {
      try {
        const prompt = buildOpeningDialoguePrompt('service', player, cast, { guest, outfit: plan.outfit, stockings: plan.stockings })
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
        })
        return res.ok ? ((await res.json()).content ?? '').trim() || fallback : fallback
      } catch { return fallback }
    })()
    const sugs = (async () => {
      const sugPrompt = `为以下服务场景生成3个玩家可选的开场行动指令。\n魔物娘：${girl.name}（${girl.race}），性格：${girl.personality}${speechLine(girl, '，')}，服从度：${girl.obedience}/100，淫乱度：${girl.lewdness}/100，客人需求：${guest.desires}\n\n要求：\n- 行动1：玩家/客人主动发起，5-12字\n- 行动2：双方互动，5-12字\n- 行动3：魔物娘主动发起，5-12字\n- 贴合角色性格与服从度\n- 只输出JSON数组：["行动1","行动2","行动3"]`
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
    const wasTransition = transitionRef.current
    // 本地回看：越过高潮闸门就在下一回合附一句校正
    setNextNote(climaxSlipNote(raw, liveRef.current.heat?.justClimaxed ?? []) + shortReplyNote(raw, settings.proseStyle))
    setRecentMetaphors((m) => pushRecent(m, extractMetaphors(raw)))
    setRecentBank((m) => [...m.filter((w) => !bankWordsUsed(raw).includes(w)), ...bankWordsUsed(raw)].slice(-30))
    transitionRef.current = false
    const actions = parseActionsFromReply(raw)
    if (actions) setSuggestions(actions)
    else {
      setSuggestions((prev) => prev ?? ['继续当前行动', '加深刺激力度', '改变姿势角度'])
      // 模型漏了 ACTIONS 块：再用建议提示词补一次（失败就保留兜底）
      const ctx = sugCtxRef.current
      const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: buildSuggestionPrompt('service', raw, player.traits, ctx) }], model: settings.chatModel, apiKey, stream: false }) })
        .then(async (res) => {
          if (!res.ok) return
          const text = String((await res.json()).content ?? '')
          const m = text.match(/[[［][\s\S]*?[\]］]/)
          const arr = m ? parseLooseJson<string[]>(m[0]) : null
          if (Array.isArray(arr) && arr.length >= 3) setSuggestions([arr[0], arr[1], arr[2]])
        })
        .catch(() => { /* 离线：保留兜底建议 */ })
    }
    const multi = parseStatsFromReply(raw)
    const fallback = multi ? null : estimateStatDelta(raw)
    // 满意度：模型的 satisfaction 增量按回合/按步夹紧后计入结算（与步骤条显示同一个数）；她的快感微调兴奋/快感面板
    if (!wasTransition) setLive((s0) => cast.reduce((s, g, i) => {
      const gd = multi ? getGirlDelta(multi, g.name) : null
      return recordModelStats(s, i === 0 ? multi?.satisfactionDelta : undefined, gd ? { girlId: g.id, delta: gd.pleasureDelta } : undefined)
    }, s0))
    // 只记体力（提示词里的「体力」）；快感与满意度已由本地兴奋/快感与步骤结算给出，不再另算
    setSession((prev) => {
      const girlsStats = { ...prev.girlsStats }
      const delta = multi ? (getGirlDelta(multi, girl.name) ?? { pleasureDelta: 0, staminaDelta: -8 }) : fallback!
      for (const g of cast) girlsStats[g.id] = applyStatDelta(girlsStats[g.id], { pleasureDelta: 0, staminaDelta: (multi ? (getGirlDelta(multi, g.name) ?? delta) : delta).staminaDelta })
      return { ...prev, girlsStats, guestStats: prev.guestStats ? applyStatDelta(prev.guestStats, { pleasureDelta: 0, staminaDelta: delta.staminaDelta }) : undefined }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [girl.id, girl.name])

  const finish = (state: LiveState) => onFinish({ state, messages })
  const sugCtxRef = useRef<SuggestionCtx>({})
  const stepDef = SERVICE_STEPS[live.stepIndex]
  // 准备页定下的这一场流程（没有就按她的专属 → 全馆默认）；挂到某步的 play 只写进那一步的做法提示
  const stepActions = plan.flow?.actions ?? getStepActions(player, girl)
  const promptActions = stepActionsWithPlays(stepActions, plan.flow?.playSteps, (id) => ALL_PLAYS.find((p) => p.id === id)?.name)
  const preview = applyPartners(resolveLiveSteps(plan, live), plan)
  const currentStep = preview.steps[live.stepIndex]
  const zoneVal = currentStep.zone ? girl.sensitivities?.[currentStep.zone] : undefined
  const outfitName = `${OUTFITS.find((o) => o.id === live.outfit)?.name ?? '常服'}${live.stockings !== 'none' ? ' + ' + STOCKINGS.find((x) => x.id === live.stockings)?.name : ''}`
  const stepContext = buildStepContext({
    stepLabel: stepDef.label,
    stepIndex: live.stepIndex,
    standardAction: promptActions[live.stepIndex],
    outfitName,
    zoneLabel: currentStep.zone,
    zoneLevel: zoneVal !== undefined ? getSensitivityLevel(zoneVal) : undefined,
    plays: preview.plays.map((p) => p.name),
    availablePlays: insertablePlays(plan, live).map((p) => p.name),
  })
  const stepPlayIds = preview.plays.map((p) => p.id).filter((id) => playStepOf(id, plan.flow?.playSteps, insertedAt) === live.stepIndex)
  const craft = buildCraftBlock({ stepIndex: live.stepIndex, girl, mainSkill: getMainService(guest), playIds: stepPlayIds, flowRace: presetFlowRace(plan.flow, live.stepIndex) })
  // 多人：分工 + 正戏时协同那一份的写作素材
  const partnersList = plan.partners ?? []
  const division = divisionBlock(girl, partnersList, guest, live.stepIndex)
  const partnerCraft = live.stepIndex === 3 ? partnersList.map((p) => { const r = partnerRole(p, getMainService(guest)); return r === '无' ? '' : skillCraftLine(p, r) }).filter(Boolean).join('\n') : ''
  // 协同在正戏里按自己的分工技能来写（不再全员都写主类型）；play 只算主位的
  const behaviour = cast.map((g, i) => {
    const role = i === 0 ? currentStep.note : partnerRole(g, getMainService(guest))
    return buildBehaviourLines(g.name, stepBehaviour(g, live.stepIndex, currentStep.zone, role === '无' ? undefined : role, i === 0 ? preview.plays.map((p) => p.id) : []))
  }).filter(Boolean).join('\n')
  const heatBlock = live.heat ? heatPromptBlock(live.heat, guest.name, cast) : ''
  const usedPlays = preview.plays.filter((p) => playStepOf(p.id, plan.flow?.playSteps, insertedAt) < live.stepIndex).map((p) => p.name)
  const recentLine = recentUseLine(recentMetaphors.slice(-8), usedPlays)
  const ctxAll = [stepContext, craft, partnerCraft, division, behaviour, heatBlock, recentLine].filter(Boolean).join('\n')
  // 提示词里的「满意度」用结算同一个数（不再有另算的射精满足度）
  const promptSession = { ...session, messages, guest: session.guest ? { ...session.guest, satisfaction: preview.satisfaction } : session.guest }
  const systemPrompt = buildServiceSystemPrompt(player, promptSession, settings.proseStyle, ctxAll, { outfit: live.outfit, stockings: live.stockings, heatLocal: !!live.heat,
    dense: { stepIndex: live.stepIndex, climaxAllowed: (live.heat?.justClimaxed.length ?? 0) > 0 || (live.stepIndex === 4 && (live.heat?.guest.climaxes ?? 0) > 0), seed: messages.length, avoid: recentBank } })
  const recap = buildStepRecap(preview.steps.map((st, i) => ({
    label: SERVICE_STEPS[i].label, score: st.score, max: STEP_MAX, turns: live.turns[i],
    key: i === 3 && preview.plays.length ? `${st.note ?? ''}+${preview.plays.map((p) => p.name).join('、')}` : (st.zone ?? stepActions[i]?.slice(0, 8)),
  })), live.stepIndex)
  const shownSuggestions: [string, string, string] = [stepActions[live.stepIndex], suggestions?.[1] ?? '与她贴身调情', suggestions?.[2] ?? '她主动靠近']
  const owned = new Set(wardrobe)
  const outfitOpts = OUTFITS.filter((o) => o.id === 'regular' || owned.has(o.id))
  const stockingOpts = STOCKINGS.filter((x) => x.id === 'none' || owned.has(x.id))
  const playOpts = insertablePlays(plan, live)
  sugCtxRef.current = {
    step: stepDef.label, standardAction: promptActions[live.stepIndex], desires: guest.desires,
    plays: preview.plays.map((p) => p.name), available: playOpts.map((p) => p.name),
    needs: [guest.desireDetail, `主需求 ${getMainService(guest)}`, guest.prefOutfit ? `服装偏好 ${guest.prefOutfit}` : ''].filter(Boolean).join('；'),
  }
  const mainSkill = getMainService(guest)
  const playsUsedRef = useRef(live.plays.length)
  const [pending, setPending] = useState<{ text: string; opts?: SendOpts } | null>(null)
  // 先按玩家这句话推进回合质量与兴奋/快感（或先切到下一步），等提示词更新后再发（这一回合的叙述要对得上新数值）
  useEffect(() => {
    if (pending === null) return
    chatRef.current?.sendMessage(pending.text, pending.opts)
    setPending(null)
  }, [pending, systemPrompt])
  const send = (text: string) => {
    const t = text.trim()
    if (!t || live.finished) return
    const topic = topicHit(t, {
      desires: guest.desires, desireDetail: guest.desireDetail, stepIndex: live.stepIndex, stepAction: stepActions[live.stepIndex],
      playNames: preview.plays.map((p) => p.name), zone: currentStep.zone, mainSkill, prefOutfit: guest.prefOutfit ?? undefined,
    })
    const newPlays = Math.max(0, live.plays.length - playsUsedRef.current)
    playsUsedRef.current = live.plays.length
    setLive((s) => recordTurn(s, { text: t, topic, heat: { guest, girls: cast, mainSkill, zone: currentStep.zone, newPlays, outfit: s.outfit, stockings: s.stockings } }))
    setPending({ text: t })
    setInputValue('')
  }
  const goNext = () => {
    const n = nextStep(live)
    setPanel('none')
    if (n.finished) { finish(n); return }
    setLive(n)
    if (chatRef.current?.isBusy()) return  // 上一条还在写：只切步，不再叠一段转场
    // 自动转场：按新一步的做法与当前兴奋/快感让模型写一段过渡；失败用本地一句。转场回复不计满意度
    const h = n.heat
    const t = {
      from: SERVICE_STEPS[live.stepIndex].label, to: SERVICE_STEPS[n.stepIndex].label,
      action: promptActions[n.stepIndex] ?? '', girls: cast.map((g) => g.name), guest: guest.name,
      heatLine: h ? [`${guest.name}${speechBand(h.guest)}`, ...cast.map((g) => h.girls[g.id] ? `${g.name}${speechBand(h.girls[g.id])}` : '')].filter(Boolean).join('、') : undefined,
    }
    transitionRef.current = true
    setPending({ text: transitionTurn(t), opts: { hidden: true, label: `进入「${t.to}」`, fallback: transitionFallback(t) } })
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
          const seedMeta = `\n<!--STATS:${JSON.stringify({ girls: Object.fromEntries(cast.map((g) => [g.name, { pleasure: 0, stamina: 0 }])), satisfaction: 0 })}-->` +
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
          <span data-testid="live-satisfaction" title={`步骤 ${preview.standardScore} + play ${preview.playScore} + 加成 ${preview.satisfactionBonus} + 匹配 ${preview.live.liveMatch} + 投入 ${preview.live.model} + 高潮 ${preview.live.heat}${preview.synergy !== undefined ? ` + 默契 ${preview.synergy}` : ''}`}>满意度 {preview.satisfaction}（{preview.tier.label}）</span>
          <span data-testid="live-outfit">服装 {outfitName}</span>
          <span className="flex-1" />
          <button className="underline hover:text-rose-400" onClick={() => finish(live)}>提前结束</button>
        </div>
        {live.heat && <HeatPanel heat={live.heat} guest={guest} girls={cast} />}
        <GuestPrefs guest={guest} girls={cast} outfit={live.outfit} stockings={live.stockings} compact />
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
              <button key={p.id} className="rounded-md border border-border pl-1 pr-2 py-0.5 text-[11px] hover:border-amber-400/60 inline-flex items-center gap-1"
                onClick={() => { setLive((s) => insertPlay(plan, s, p.id)); setInsertedAt((m) => ({ ...m, [p.id]: live.stepIndex })); setPanel('none') }}><ItemIcon src={playIconPath(p.id)} name={p.name} size={18} />{p.name}</button>
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
        <ChatEngine ref={chatRef} systemPrompt={systemPrompt} recap={recap} messages={messages} onMessagesChange={setMessages} onRememberUser={onRemember}
          settings={settings} turnSuffix={lengthReminder('service', settings.proseStyle) + nextNote} onRawStreamComplete={handleRawReply} showInput={false} className="flex-1 min-h-0" />
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

export function TrainingScene({ player, girl, directionLabel, trainingInfo, extraPrompt, settings, onFinish, scene, day, onRemember, zone, drillSkill }: {
  onRemember?: (text: string) => void
  /** 敏感开发的部位（她的快感按这条带的敏感档推进） */
  zone?: SensitivityZone
  /** 特训的技能（提示词附上这项技能的写作素材） */
  drillSkill?: SkillKey
  player: Player
  girl: MonstGirl
  directionLabel: string
  scene?: SceneId
  day?: number
  /** 调教上下文（方向效果 / 道具 / 调教室 / 目标），缺省只写方向名 */
  trainingInfo?: string
  /** 附在提示词末尾（惩罚缘由等） */
  extraPrompt?: string
  settings: AppSettings
  onFinish: (turns: number, pleasure: number, provoke?: SceneId) => void
}) {
  const [session] = useState<ServiceSession>(() => createServiceSession('training', [girl], {}))
  // 对话里触到阴影：本场激发一次，之后每回合的提示词都带【激发阴影】，结算时生效
  const [provoked, setProvoked] = useState<SceneId | undefined>()
  const [pending, setPending] = useState<string | null>(null)
  const seedMeta = `\n<!--STATS:${JSON.stringify({ girls: { [girl.name]: { pleasure: 0, stamina: 0 } }, satisfaction: 0 })}-->` +
    `\n<!--ACTIONS:["命令她跪下","抬起她的下巴","她低声求饶"]-->`
  const staticOpening = `${getScene(scene) ? `${getScene(scene)!.name}的门缓缓关上。${getScene(scene)!.desc}` : '调教室的门缓缓关上。'}${girl.name}被带到你面前，今天的项目是「${directionLabel}」。`
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // 开场白：按场景 / 方向 / 她的状态 / 性癖 / 阴影请求一段；失败用静态句
  const [opening, setOpening] = useState<{ loading: boolean; text: string }>({ loading: true, text: '' })
  useEffect(() => {
    let ignore = false
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const prompt = buildTrainingOpeningPrompt(player, girl, { directionLabel, scene, day, trainingInfo, extra: extraPrompt })
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }) })
      .then(async (res) => (res.ok ? String((await res.json()).content ?? '').replace(/<!--[\s\S]*?-->/g, '').trim() : ''))
      .catch(() => '')
      .then((t) => { if (!ignore) setOpening({ loading: false, text: t || staticOpening }) })
    return () => { ignore = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [turns, setTurns] = useState(0)
  const [pleasure, setPleasure] = useState(0)
  const [suggestions, setSuggestions] = useState<[string, string, string] | null>(['命令她跪下', '抬起她的下巴', '她低声求饶'])
  const [inputValue, setInputValue] = useState('')
  const chatRef = useRef<ChatEngineHandle>(null)
  // 本地兴奋/快感档位：她的说话随回合推进（调教结算仍用下方的「快感」）
  const [heat, setHeat] = useState<HeatState>(() => initTrainingHeat(girl))
  const heatRef = useRef(heat)
  useEffect(() => { heatRef.current = heat }, [heat])
  const [nextNote, setNextNote] = useState('')
  const [recentMetaphors, setRecentMetaphors] = useState<string[]>([])
  const [recentBank, setRecentBank] = useState<string[]>([])
  const drillCraft = drillSkill ? `【特训技能的写法】\n${skillCraftLine(girl, drillSkill)}` : ''
  const trainCtx = [heatPromptBlock(heat, player.name, [girl]), drillCraft, recentUseLine(recentMetaphors.slice(-8), [])].filter(Boolean).join('\n')
    + `\n\n${trainingInfo ?? `【本次调教方向】${directionLabel}`}` + (extraPrompt ? `\n${extraPrompt}` : '') + (provoked ? provokeSection(girl, provoked) : '')
  // 重油段在最末尾：调教按回合阶段（1 挑逗 / 2 前戏 / 3 正戏）筛词
  const systemPrompt = buildServiceSystemPrompt(player, { ...session, messages }, settings.proseStyle, trainCtx, { scene, day, heatLocal: true,
    dense: { stepIndex: TRAINING_PHASE(turns + 1), climaxAllowed: heat.justClimaxed.length > 0, seed: messages.length, avoid: recentBank } })

  // 激发后要等提示词更新再发这句话
  useEffect(() => {
    if (pending === null) return
    chatRef.current?.sendMessage(pending)
    setPending(null)
  }, [pending, systemPrompt])

  const onRaw = useCallback((raw: string) => {
    setNextNote(climaxSlipNote(raw, heatRef.current.justClimaxed) + shortReplyNote(raw, settings.proseStyle))
    setRecentMetaphors((m) => pushRecent(m, extractMetaphors(raw)))
    setRecentBank((m) => [...m.filter((w) => !bankWordsUsed(raw).includes(w)), ...bankWordsUsed(raw)].slice(-30))
    const a = parseActionsFromReply(raw)
    if (a) setSuggestions(a)
    const multi = parseStatsFromReply(raw)
    const d = multi ? (getGirlDelta(multi, girl.name) ?? { pleasureDelta: 5, staminaDelta: -8 }) : estimateStatDelta(raw)
    setPleasure((p) => Math.max(0, Math.min(100, p + d.pleasureDelta)))
  }, [girl.name])
  const send = (t: string) => {
    if (!t.trim()) return
    setTurns((n) => n + 1)
    setInputValue('')
    // 先推进档位，等提示词更新后再发（这一回合的叙述要对得上新档位）
    setHeat((h) => trainingHeatTurn(h, girl, turns + 1, t, zone))
    const hit = !provoked && day ? detectShadowTrigger(girl, scene, t, day) : null
    if (hit) setProvoked(hit)
    setPending(t.trim())
  }

  if (!messages.length) {
    return (
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto w-full" data-testid="tr-opening">
        <h2 className="text-base font-bold gold-text">{getScene(scene)?.name ?? '调教室'} · {directionLabel}</h2>
        <div className="bg-card border border-border rounded-xl p-5 w-full min-h-[80px] flex items-center justify-center">
          {opening.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /><span>布置场景中…</span></div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap" data-testid="tr-opening-text">{opening.text}</p>
          )}
        </div>
        <Button className="h-10 px-8 glow-btn gap-2" disabled={opening.loading} data-testid="tr-opening-continue"
          onClick={() => setMessages([{ role: 'assistant', content: opening.text + seedMeta }])}>
          开始调教 <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-border px-3 py-2 flex items-center gap-3 text-[11px] text-foreground/75 shrink-0">
        <span className="gold-text font-semibold">{girl.name}</span>
        <span>{directionLabel}</span>
        <span data-testid="tr-turns">回合 {turns}</span>
        <span>快感 {pleasure}</span>
        <span data-testid="tr-band">{girl.name}：{speechBand(heat.girls[girl.id] ?? { arousal: 0, pleasure: 0, climaxes: 0 }, heat.justClimaxed.includes(girl.id))}</span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs border-rose-500/30 text-rose-400" onClick={() => onFinish(turns, pleasure, provoked)} data-testid="btn-end-training">
          结束调教
        </Button>
      </div>
      {provoked && (
        <p className="px-3 py-1 text-[10px] text-slate-300 bg-slate-500/10 border-b border-slate-400/20 shrink-0" data-testid="tr-provoked-notice">
          你的话触到了她在{getScene(provoked)!.name}的阴影……她在发抖（本场服从大涨、多耗体力，阴影加深）
        </p>
      )}
      <ChatEngine ref={chatRef} systemPrompt={systemPrompt} messages={messages} onMessagesChange={setMessages} onRememberUser={onRemember}
        settings={settings} turnSuffix={lengthReminder('training', settings.proseStyle) + nextNote} onRawStreamComplete={onRaw} showInput={false} className="flex-1 min-h-0" />
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

