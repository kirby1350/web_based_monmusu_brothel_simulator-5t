'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ArrowLeft, CheckCircle, Loader2, Send,
  ChevronRight, Save, BookOpen, X, Bookmark, Star,
} from 'lucide-react'
import {
  GameSave, MonstGirl, Guest, ChatMessage, ServiceSession, AppSettings,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatBar } from '@/components/stat-bar'
import { GirlCard } from '@/components/girl-card'
import { GuestCard } from '@/components/guest-card'
import { ChatEngine, ChatEngineHandle } from '@/components/chat-engine'
import { SuggestionBar } from '@/components/suggestion-bar'
import {
  buildServiceSystemPrompt, buildOpeningDialoguePrompt, buildMemoryPrompt,
} from '@/lib/prompt-builder'
import {
  createServiceSession, applyStatDelta, estimateStatDelta, parseStatsFromReply, getGirlDelta,
  calcServiceReward, calcGirlStatGrowth, updateGuestSatisfaction, findEligibleTrainers,
  parseActionsFromReply, evaluateSkillUnlocks, getSatisfactionTier, applyReputationDelta, rollBecameRegular,
  computeInitialSatisfaction, getGuestMatch,
} from '@/lib/game-engine'
import { cn, parseLooseJson } from '@/lib/utils'
import {
  getSavedGuests, saveGuest, deleteSavedGuest,
} from '@/lib/storage'

// ─── Preset preference tags ──────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceStep = 'pick' | 'opening' | 'active' | 'result'

interface ServiceScreenProps {
  save: GameSave
  type: 'service' | 'training'
  settings: AppSettings
  onSaveChange: (save: GameSave) => void
  onBack: () => void
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ServiceScreen({ save, type, settings, onSaveChange, onBack }: ServiceScreenProps) {
  const { player, girls } = save

  const [step, setStep] = useState<ServiceStep>('pick')
  const [selectedGirls, setSelectedGirls] = useState<string[]>([])
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [session, setSession] = useState<ServiceSession | null>(null)
  const [lastAiMsg, setLastAiMsg] = useState('')
  const [suggestions, setSuggestions] = useState<[string, string, string] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [goldEarned, setGoldEarned] = useState(0)
  // Record stat deltas for result screen: girlId -> { affection, obedience, lewdness }
  const [girlGrowths, setGirlGrowths] = useState<Record<string, { affection: number; obedience: number; lewdness: number }>>({})
  // 结算附加信息：技能解锁（girlId -> 新技能）、满意度评价、声望增减、是否成为回头客
  const [skillUnlocks, setSkillUnlocks] = useState<Record<string, string[]>>({})
  const [settleInfo, setSettleInfo] = useState<{ tierLabel: string; reputationDelta: number; becameRegular: boolean } | null>(null)
  const [openingText, setOpeningText] = useState('')
  const [openingDialogue, setOpeningDialogue] = useState('') // character interaction line
  const [openingLoading, setOpeningLoading] = useState(false)
  const [dialogueLoading, setDialogueLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  // Saved guests panel
  const [savedGuests, setSavedGuests] = useState<Guest[]>([])
  const [savedGuestsOpen, setSavedGuestsOpen] = useState(false)
  // Memory / save-guest state
  const [memorySaving, setMemorySaving] = useState(false)
  const [memorySaved, setMemorySaved] = useState(false)

  const chatRef = useRef<ChatEngineHandle>(null)
  const eligibleTrainers = findEligibleTrainers(girls)

  // Load saved guests on mount
  useEffect(() => {
    setSavedGuests(getSavedGuests())
  }, [])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const toggleGirl = (id: string) => {
    setSelectedGirls((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // 当天的客人池（开局一次性随机生成，存于存档）；接待后会从池中移除
  const dailyGuests = save.dailyGuests ?? []

  const handleQuickSaveGuest = () => {
    if (!guest) return
    saveGuest(guest)
    setSavedGuests(getSavedGuests())
  }

  const handleLoadGuest = (g: Guest) => {
    setGuest({ ...g, satisfaction: 0 })
    setSavedGuestsOpen(false)
  }

  const handleDeleteSavedGuest = (id: string) => {
    deleteSavedGuest(id)
    setSavedGuests(getSavedGuests())
  }

  const canStart = type === 'service'
    ? (selectedGirls.length > 0 && guest !== null)
    : selectedGirls.length > 0

  // ─── Start session ───────────────────────────────────────────────────────────

  const startSession = async () => {
    const sessionGirls = girls.filter((g) => selectedGirls.includes(g.id))
    const trainer = type === 'training' && selectedTrainerId
      ? girls.find((g) => g.id === selectedTrainerId)
      : undefined
    // 开场偏好匹配：命中的客人带着初始满意度进入会话
    const startGuest = type === 'service' && guest
      ? { ...guest, satisfaction: computeInitialSatisfaction(guest, sessionGirls) }
      : undefined
    const newSession = createServiceSession(type, sessionGirls, {
      guest: startGuest,
      trainer: type === 'training' ? trainer : undefined,
    })
    setSession(newSession)
    setStep('opening')
    setOpeningText('')
    setOpeningDialogue('')
    setOpeningLoading(true)
    setSuggestions(null)

    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const mainGirl = sessionGirls[0]

    // Step 1 & 2: Generate scene description + initial suggestions in parallel
    const scenePromise = (async () => {
      try {
        const sceneType = type === 'service' ? 'service' : 'training'
        const prompt = buildOpeningDialoguePrompt(sceneType, player, sessionGirls, { guest: guest ?? undefined })
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
        })
        return res.ok
          ? ((await res.json()).content ?? '').trim() || (type === 'service' ? '客人踏入了包间……' : '调教室的门缓缓关上……')
          : (type === 'service' ? '客人踏入了包间……' : '调教室的门缓缓关上……')
      } catch {
        return type === 'service' ? '客人踏入了包间……' : '调教室的门缓缓关上……'
      }
    })()

    const suggestionsPromise = mainGirl ? (async () => {
      const girlDesc = sessionGirls
        .map((g) => `${g.name}（${g.race}），性格：${g.personality}，服从度：${g.obedience}/100，淫乱度：${g.lewdness}/100`)
        .join('；')
      const guestDesc = type === 'service' && guest ? `，客人需求：${guest.desires}` : ''
      const sugPrompt = `为以下${type === 'service' ? '服务' : '调教'}场景生成3个玩家可选的开场行动指令。\n${sessionGirls.length > 1 ? `参与的魔物娘（共${sessionGirls.length}位）：` : '魔物娘：'}${girlDesc}${guestDesc}\n\n要求：\n- 行动1：玩家/客人主动发起（如主动抚摸、命令脱衣、直接进入等），5-12字\n- 行动2：双方互动（如相互撩拨、眼神挑逗、语言调情等），5-12字\n- 行动3：魔物娘主动发起（如她主动靠近、撒娇求抱、主动解衣等），5-12字\n- 贴合角色性格与服从度\n- 只输出JSON数组：["行动1","行动2","行动3"]`
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: sugPrompt }], model: settings.chatModel, apiKey, stream: false }),
        })
        if (!res.ok) return null
        const text = ((await res.json()).content ?? '').trim()
        const match = text.match(/\[[\s\S]*?\]/)
        if (!match) return null
        const arr = parseLooseJson<string[]>(match[0])
        if (!Array.isArray(arr) || arr.length < 3) return null
        return [arr[0], arr[1], arr[2]] as [string, string, string]
      } catch { return null }
    })() : Promise.resolve(null)

    const [sceneText, initialSuggestions] = await Promise.all([scenePromise, suggestionsPromise])
    setOpeningText(sceneText)
    setOpeningLoading(false)
    if (initialSuggestions) setSuggestions(initialSuggestions)

    // Step 2: Generate a character interaction line — temporarily disabled
    // setDialogueLoading(true)
    // ... (streaming dialogue prompt disabled)
  }

  // ─── Session helpers ─────────────────────────────────────────────────────────

  const handleRawReply = useCallback((rawContent: string) => {
    setLastAiMsg(rawContent)
    // Parse suggested actions — only update if we got valid actions, keep previous otherwise
    const actions = parseActionsFromReply(rawContent)
    if (actions) setSuggestions(actions)
    // If no ACTIONS block at all, generate fallback suggestions from keywords in reply
    else {
      setSuggestions((prev) => {
        if (prev) return prev // keep existing suggestions
        // derive 3 generic fallback actions so the bar is never empty
        return ['继续当前行动', '加深刺激力度', '改变姿势角度']
      })
    }
    if (!session) return

    // Try AI-generated multi-stats first, fallback to keyword estimation
    const multiStats = parseStatsFromReply(rawContent)
    const fallbackDelta = multiStats ? null : estimateStatDelta(rawContent)
    const satisfactionDelta = multiStats?.satisfactionDelta

    setSession((prev) => {
      if (!prev) return prev
      const newGirlsStats = { ...prev.girlsStats }
      for (const g of prev.girls) {
        // Per-girl delta from multi-stats, or shared fallback
        const delta = multiStats
          ? (getGirlDelta(multiStats, g.name) ?? { pleasureDelta: 5, staminaDelta: -8 })
          : fallbackDelta!
        newGirlsStats[g.id] = applyStatDelta(newGirlsStats[g.id], delta)
      }
      // Guest/trainer use average pleasure from all girls or fallback
      const avgPleasureDelta = multiStats
        ? Object.values(multiStats.girls).reduce((s, v) => s + v.pleasureDelta, 0) / Math.max(1, Object.keys(multiStats.girls).length)
        : fallbackDelta!.pleasureDelta
      const avgStaminaDelta = multiStats
        ? Object.values(multiStats.girls).reduce((s, v) => s + v.staminaDelta, 0) / Math.max(1, Object.keys(multiStats.girls).length)
        : fallbackDelta!.staminaDelta
      const sharedDelta = { pleasureDelta: Math.round(avgPleasureDelta), staminaDelta: Math.round(avgStaminaDelta) }
      return {
        ...prev,
        girlsStats: newGirlsStats,
        guestStats: prev.guestStats ? applyStatDelta(prev.guestStats, sharedDelta) : undefined,
        trainerStats: prev.trainerStats ? applyStatDelta(prev.trainerStats, sharedDelta) : undefined,
        guest: prev.guest ? updateGuestSatisfaction(prev.guest, sharedDelta.pleasureDelta, satisfactionDelta) : undefined,
        messages,
      }
    })
  }, [session, messages])

  const endSession = () => {
    if (!session) return
    let updatedGirls = [...girls]
    let earned = 0
    if (session.type === 'service' && session.guest) {
      earned = calcServiceReward(session.guest, session)
    }
    const turnCount = messages.filter((m) => m.role === 'user').length
    const growths: Record<string, { affection: number; obedience: number; lewdness: number }> = {}
    const unlocks: Record<string, string[]> = {}
    for (const girl of session.girls) {
      const before = { affection: girl.affection, obedience: girl.obedience, lewdness: girl.lewdness }
      const growth = calcGirlStatGrowth(girl, session, turnCount)
      const grown = { ...girl, ...growth }
      // 数值成长后判定本次新解锁的侍奉技能
      const newSkills = evaluateSkillUnlocks(grown)
      const merged = newSkills.length > 0 ? { ...grown, skills: [...grown.skills, ...newSkills] } : grown
      if (newSkills.length > 0) unlocks[girl.id] = newSkills
      updatedGirls = updatedGirls.map((g) => g.id === girl.id ? merged : g)
      growths[girl.id] = {
        affection: (growth.affection ?? before.affection) - before.affection,
        obedience: (growth.obedience ?? before.obedience) - before.obedience,
        lewdness: (growth.lewdness ?? before.lewdness) - before.lewdness,
      }
    }

    // 满意度分档：决定声望增减、是否成为回头客（仅服务场景）
    let reputationDelta = 0
    let becameRegular = false
    let tierLabel = ''
    let updatedRegulars = save.regulars ?? []
    const servedGuest = session.type === 'service' ? session.guest : undefined
    if (servedGuest) {
      const tier = getSatisfactionTier(servedGuest.satisfaction)
      tierLabel = tier.label
      reputationDelta = tier.reputationDelta
      becameRegular = rollBecameRegular(tier)
      if (becameRegular) {
        // 累计回访次数 +1，沉淀进回头客池（按 id 去重更新，保留已有记忆）
        const existing = updatedRegulars.find((r) => r.id === servedGuest.id)
        const regular: Guest = {
          ...servedGuest,
          visits: (servedGuest.visits ?? 0) + 1,
          memories: existing?.memories ?? servedGuest.memories,
        }
        updatedRegulars = [regular, ...updatedRegulars.filter((r) => r.id !== servedGuest.id)].slice(0, 20)
      }
    }

    setGirlGrowths(growths)
    setSkillUnlocks(unlocks)
    setGoldEarned(earned)
    setSettleInfo(servedGuest ? { tierLabel, reputationDelta, becameRegular } : null)
    setMemorySaved(false)
    setMemorySaving(false)
    onSaveChange({
      ...save,
      girls: updatedGirls,
      player: {
        ...player,
        gold: player.gold + earned,
        day: save.currentDay,
        reputation: applyReputationDelta(player.reputation, reputationDelta),
      },
      actionsUsedToday: (save.actionsUsedToday ?? 0) + 1,
      // 服务场景：把已接待客人移出今日客人池
      dailyGuests: servedGuest
        ? (save.dailyGuests ?? []).filter((g) => g.id !== servedGuest.id)
        : save.dailyGuests,
      regulars: updatedRegulars,
    })
    setStep('result')
  }

  // Generate relationship memories then save the guest
  const handleSaveGuest = async () => {
    const currentSession = session
    const currentGuest = currentSession?.guest
    if (!currentGuest || memorySaved || memorySaving) return
    setMemorySaving(true)
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const existingSaved = getSavedGuests().find((g) => g.id === currentGuest.id)

    // Build session summary from last assistant message
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    const summary = lastAssistant?.content?.slice(0, 120) ?? '进行了一次服务'

    // Generate memories for each girl in parallel
    const newMemories: NonNullable<Guest['memories']> = { ...(existingSaved?.memories ?? {}) }
    const girls = currentSession?.girls ?? []
    await Promise.all(girls.map(async (girl) => {
      try {
        const existing = existingSaved?.memories?.[girl.name]
        const prompt = buildMemoryPrompt(currentGuest, girl, summary, existing)
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
        })
        if (!res.ok) return
        const text = ((await res.json()).content ?? '').trim()
        const match = text.match(/\{[\s\S]*?\}/)
        if (!match) return
        const parsed = parseLooseJson<{ guestAboutGirl?: string; girlAboutGuest?: string }>(match[0])
        if (!parsed) return
        newMemories[girl.name] = {
          guestAboutGirl: parsed.guestAboutGirl ?? '',
          girlAboutGuest: parsed.girlAboutGuest ?? '',
          visitCount: (existing?.visitCount ?? 0) + 1,
        }
      } catch { /* skip on error */ }
    }))

    const guestToSave: Guest = { ...currentGuest, memories: newMemories }
    saveGuest(guestToSave)
    setSavedGuests(getSavedGuests())
    // 若该客人已沉淀为回头客，把新记忆同步进回头客池，下次回访即可带着记忆出场
    if ((save.regulars ?? []).some((r) => r.id === guestToSave.id)) {
      onSaveChange({
        ...save,
        regulars: (save.regulars ?? []).map((r) => r.id === guestToSave.id ? { ...r, memories: newMemories } : r),
      })
    }
    setMemorySaving(false)
    setMemorySaved(true)
  }

  const systemPrompt = session ? buildServiceSystemPrompt(player, { ...session, messages }, settings.proseStyle) : ''

  // ─── UI ──────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="w-7 h-7"
          onClick={() => (step === 'active' ? endSession() : onBack())}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-sm font-bold gold-text">
          {type === 'service' ? '开张营业' : '调教训练'}
        </h1>
        <Badge variant="secondary" className="text-[10px] h-5 px-2">
          {step === 'pick' && (type === 'service' ? '选择客人与魔物娘' : '选择调教对象')}
          {step === 'opening' && '开场'}
          {step === 'active' && '进行中'}
          {step === 'result' && '结束'}
        </Badge>
      </header>

      {/* ── Step: pick ── */}
      {step === 'pick' && (
        <div className="flex flex-1 min-h-0">

          {/* LEFT — Guest (service only) or Training config */}
          <div className="w-1/2 border-r border-border flex flex-col min-h-0">
            {type === 'service' ? (
              <>
                {/* Guest toolbar */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
                  <span className="text-xs font-semibold gold-text flex-1">今日客人（{dailyGuests.length}）</span>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="已保存客人"
                    onClick={() => setSavedGuestsOpen((v) => !v)}>
                    <BookOpen className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="保存当前客人"
                    disabled={!guest} onClick={handleQuickSaveGuest}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Saved guests panel */}
                {savedGuestsOpen && (
                  <div className="border-b border-border bg-card/50 p-3 space-y-2 max-h-48 overflow-y-auto shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">已保存的客人</span>
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setSavedGuestsOpen(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {savedGuests.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">暂无保存</p>
                    ) : (
                      savedGuests.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-amber-400">{g.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">{g.race}</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary"
                            onClick={() => handleLoadGuest(g)}>读取</Button>
                          <Button variant="ghost" size="icon" className="w-5 h-5 text-muted-foreground hover:text-rose-400"
                            onClick={() => handleDeleteSavedGuest(g.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 今日客人选择（开局已随机生成，从池中挑选） */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {dailyGuests.length === 0 && !guest ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-center">
                      <p className="text-xs">今日客人已全部接待完毕</p>
                      <p className="text-[10px] text-muted-foreground/60">「结束今天」后会有新的客人到访</p>
                    </div>
                  ) : (
                    <>
                      {dailyGuests.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 px-0.5">选择一位今日客人开始服务</p>
                      )}
                      {dailyGuests.map((dg) => (
                        <button
                          key={dg.id}
                          onClick={() => setGuest(dg)}
                          className={cn(
                            'w-full text-left rounded-lg border p-2.5 transition-all',
                            guest?.id === dg.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/40'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-amber-400">{dg.name}</span>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{dg.race}</Badge>
                            {(dg.visits ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-pink-500/15 text-pink-300 border border-pink-500/30">
                                <Star className="w-2.5 h-2.5 mr-0.5" />回头客·{dg.visits}
                              </Badge>
                            )}
                            <span className="text-[9px] text-muted-foreground ml-auto truncate max-w-[40%]">{dg.personality}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">需求：{dg.desires}</p>
                          {(dg.prefRace || dg.prefTrait) && (
                            <p className="text-[10px] text-pink-300/70 mt-0.5">
                              偏好：{[dg.prefRace, dg.prefTrait].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </button>
                      ))}
                      {guest && (
                        <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
                          <GuestCard guest={guest} settings={settings} />
                          {(() => {
                            const sg = girls.filter((g) => selectedGirls.includes(g.id))
                            const m = getGuestMatch(guest, sg)
                            return (
                              <div className="rounded-lg border border-border bg-card/40 p-2 text-[10px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">偏好匹配（按已选魔物娘）</span>
                                  <span className={cn('font-semibold', m.bonus > 0 ? 'text-emerald-400' : 'text-muted-foreground')}>初始满意度 +{m.bonus}</span>
                                </div>
                                <div className="flex gap-3">
                                  <span className={m.raceMatched ? 'text-emerald-400' : 'text-muted-foreground/60'}>
                                    {m.raceMatched ? '✓' : '×'} 种族·{guest.prefRace ?? '—'}
                                  </span>
                                  <span className={m.traitMatched ? 'text-emerald-400' : 'text-muted-foreground/60'}>
                                    {m.traitMatched ? '✓' : '×'} 特征·{guest.prefTrait ?? '—'}
                                  </span>
                                </div>
                                {sg.length === 0 && <p className="text-muted-foreground/50">先在右侧选择参与的魔物娘</p>}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              /* Training — trainer selection */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-xs text-muted-foreground">选择调教者</p>
                <div className="flex flex-col gap-2">
                  <button
                    className={cn(
                      'px-4 py-2.5 rounded-lg text-xs border text-left transition-all',
                      selectedTrainerId === null
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                    onClick={() => setSelectedTrainerId(null)}
                  >
                    馆主 {player.name} 亲自调教
                  </button>
                  {eligibleTrainers.map((g) => (
                    <button
                      key={g.id}
                      className={cn(
                        'px-4 py-2.5 rounded-lg text-xs border text-left transition-all',
                        selectedTrainerId === g.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                      onClick={() => setSelectedTrainerId(g.id)}
                    >
                      {g.name}（好��� {g.affection}）
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Pick girls */}
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="px-3 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/80">
                选择{type === 'service' ? '侍奉' : '调教'}的魔物娘
              </span>
              {selectedGirls.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  已选 {selectedGirls.length}
                </Badge>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {girls.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-muted-foreground text-center">
                    还没有魔物娘，请先前往奴隶市场
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {girls.map((girl) => (
                    <GirlCard
                      key={girl.id}
                      girl={girl}
                      settings={settings}
                      selected={selectedGirls.includes(girl.id)}
                      onSelect={(g) => toggleGirl(g.id)}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Start button */}
            <div className="border-t border-border p-3 shrink-0">
              <Button
                className="w-full h-10 glow-btn text-sm"
                disabled={!canStart}
                onClick={startSession}
              >
                {type === 'service' ? '开始服务' : '开始调教'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: opening ── */}
      {step === 'opening' && (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto w-full">
          <h2 className="text-base font-bold gold-text">
            {type === 'service' ? '迎接客人' : '进入调教室'}
          </h2>

          {/* Scene description */}
          <div className="bg-card border border-border rounded-xl p-5 w-full min-h-[80px] flex items-center justify-center">
            {openingLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>描述场景中…</span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-foreground/90 text-center">{openingText}</p>
            )}
          </div>

          {/* Character interaction line */}
          {(dialogueLoading || openingDialogue) && (
            <div className="bg-secondary/20 border border-border rounded-xl p-4 w-full min-h-[52px] flex items-center">
              {dialogueLoading && !openingDialogue ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>角色互动中…</span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-foreground/80 italic">
                  {openingDialogue}
                  {dialogueLoading && <span className="inline-block w-1 h-4 ml-0.5 bg-foreground/60 animate-pulse align-middle" />}
                </p>
              )}
            </div>
          )}

          <Button
            className="h-10 px-8 glow-btn gap-2"
            disabled={openingLoading || dialogueLoading}
            onClick={() => {
              const seed: ChatMessage[] = []
              if (openingText) seed.push({ role: 'assistant', content: openingText })
              if (openingDialogue) seed.push({ role: 'assistant', content: openingDialogue })
              setMessages(seed)
              setLastAiMsg(openingDialogue || openingText)
              setStep('active')
            }}
          >
            继续 <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Step: active ── */}
      {step === 'active' && session && (
        <div className="flex flex-1 min-h-0">
          {/* Left: stats panel */}
          <div className="w-48 border-r border-border flex flex-col overflow-y-auto shrink-0">
            <div className="p-3 space-y-3">
              {session.girls.map((girl) => {
                const stats = session.girlsStats[girl.id]
                return (
                  <div key={girl.id} className="bg-secondary/20 rounded-lg overflow-hidden space-y-0">
                    {/* Avatar */}
                    {girl.imageUrl && (
                      <div className="w-full aspect-[3/2] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={girl.imageUrl}
                          alt={girl.name}
                          className="w-full h-full object-cover object-top"
                        />
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
                          {stats.isExhausted && (
                            <Badge variant="outline" className="text-[8px] border-amber-500/40 text-amber-400">已疲惫</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              {session.guest && session.guestStats && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg overflow-hidden">
                  {session.guest.imageUrl && (
                    <div className="w-full aspect-[3/2] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={session.guest.imageUrl} alt={session.guest.name} className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className="p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-amber-400">{session.guest.name}</span>
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1">客</Badge>
                    </div>
                    <StatBar label="快感" value={session.guestStats.pleasure} color="gold" size="sm" />
                    <StatBar label="体力" value={session.guestStats.stamina} color="green" size="sm" />
                    <StatBar label="满意" value={session.guest.satisfaction} color="rose" size="sm" />
                  </div>
                </div>
              )}
              {session.trainer && session.trainerStats && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg overflow-hidden">
                  {session.trainer.imageUrl && (
                    <div className="w-full aspect-[3/2] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={session.trainer.imageUrl} alt={session.trainer.name} className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className="p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-primary">{session.trainer.name}</span>
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1">调教者</Badge>
                    </div>
                    <StatBar label="快感" value={session.trainerStats.pleasure} color="pink" size="sm" />
                    <StatBar label="体力" value={session.trainerStats.stamina} color="blue" size="sm" />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-auto p-3 border-t border-border">
              <Button variant="outline" size="sm"
                className="w-full h-9 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                onClick={endSession}>
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                结束{type === 'service' ? '服务' : '调教'}
              </Button>
            </div>
          </div>
          {/* Right: chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <ChatEngine
              ref={chatRef}
              systemPrompt={systemPrompt}
              messages={messages}
              onMessagesChange={setMessages}
              settings={settings}
              onRawStreamComplete={handleRawReply}
              showInput={false}
              className="flex-1 min-h-0"
            />
            <SuggestionBar
              suggestions={suggestions}
              onSelect={(text) => setInputValue(text)}
            />
            <div className="border-t border-border px-3 pb-3 pt-2 flex gap-2 items-end">
              <InputArea
                value={inputValue}
                onChange={setInputValue}
                onSend={(val) => { chatRef.current?.sendMessage(val); setInputValue('') }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Step: result ── */}
      {step === 'result' && session && (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold gold-text">
              {type === 'service' ? '服务结束' : '调教结束'}
            </h2>
            <p className="text-sm text-muted-foreground">本次活动已完成</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4">
            {/* Service: satisfaction + gold */}
            {type === 'service' && session.guest && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">客人满意度</span>
                <span className="text-sm font-semibold text-amber-400">
                  {session.guest.satisfaction} / 100
                  {settleInfo?.tierLabel && <span className="text-muted-foreground font-normal">（{settleInfo.tierLabel}）</span>}
                </span>
              </div>
            )}
            {type === 'service' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">本次收入</span>
                <span className="text-sm font-semibold gold-text">+{goldEarned} G</span>
              </div>
            )}
            {type === 'service' && settleInfo && settleInfo.reputationDelta !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">声望</span>
                <span className={cn('text-sm font-semibold', settleInfo.reputationDelta >= 0 ? 'text-pink-300' : 'text-rose-400')}>
                  {settleInfo.reputationDelta > 0 ? '+' : ''}{settleInfo.reputationDelta}
                </span>
              </div>
            )}
            {type === 'service' && settleInfo?.becameRegular && session.guest && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Star className="w-3.5 h-3.5 shrink-0" />
                「{session.guest.name}」成为了回头客，日后可能带着回忆再访
              </div>
            )}
            {(type === 'service' && session.guest) && <div className="h-px bg-border" />}

            {/* Girl stat growths */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground/70">魔物娘属性变化</p>
              {session.girls.map((girl) => {
                const g = girlGrowths[girl.id]
                if (!g) return null
                return (
                  <div key={girl.id} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold gold-text">{girl.name}</span>
                      <span className="text-[10px] text-muted-foreground">{girl.race}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatDelta label="好感" value={g.affection} color="text-pink-400" />
                      <StatDelta label="服从" value={g.obedience} color="text-sky-400" />
                      <StatDelta label="淫乱" value={g.lewdness} color="text-rose-400" />
                    </div>
                    {(skillUnlocks[girl.id]?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="text-[10px] text-emerald-400">✨ 解锁技能</span>
                        {skillUnlocks[girl.id].map((s) => (
                          <Badge key={s} variant="secondary" className="text-[9px] h-4 px-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Save guest button — only for service with guest */}
            {type === 'service' && session.guest && (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground/60">
                    保存客人后，下次服务时 AI 将记住双方的关系印象
                  </p>
                  {memorySaved ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      已保存「{session.guest.name}」并更新关系记忆
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9 text-xs border-amber-500/40 text-amber-400 hover:border-amber-500 hover:bg-amber-500/10"
                      disabled={memorySaving}
                      onClick={handleSaveGuest}
                    >
                      {memorySaving ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />正在生成关系记忆…</>
                      ) : (
                        <><Bookmark className="w-3.5 h-3.5 mr-1.5" />保存「{session.guest.name}」为常客</>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
          <Button className="w-full max-w-sm h-11 glow-btn" onClick={onBack}>返回大厅</Button>
        </div>
      )}
    </div>
  )
}

// ─── StatDelta chip ──────────────────────────────────────────────────────────

function StatDelta({ label, value, color }: { label: string; value: number; color: string }) {
  const sign = value > 0 ? '+' : ''
  return (
    <div className="flex flex-col items-center bg-secondary/30 rounded-lg py-1.5 px-2 gap-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums', color, value === 0 && 'text-muted-foreground/50')}>
        {sign}{value}
      </span>
    </div>
  )
}

// ─── Standalone input with external control ──────────────────────────────────

interface InputAreaProps {
  onSend: (text: string) => void
  value: string
  onChange: (text: string) => void
}

function InputArea({ onSend, value, onChange }: InputAreaProps) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-h-[56px] max-h-[100px] resize-none bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="描述你的行动…（Enter 发送，Shift+Enter 换行）"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (value.trim()) { onSend(value.trim()); onChange('') }
          }
        }}
      />
      <Button size="icon" className="h-9 w-9 shrink-0 glow-btn"
        disabled={!value.trim()}
        onClick={() => { if (value.trim()) { onSend(value.trim()); onChange('') } }}>
        <Send className="w-3.5 h-3.5" />
      </Button>
    </>
  )
}
