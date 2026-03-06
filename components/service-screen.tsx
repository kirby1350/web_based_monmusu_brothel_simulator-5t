'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ArrowLeft, CheckCircle, RefreshCw, Loader2, Send,
  ChevronRight, Settings2, Save, BookOpen, X, Bookmark,
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
  buildServiceSystemPrompt,
  buildGuestGenerationPrompt,
  buildOpeningDialoguePrompt,
} from '@/lib/prompt-builder'
import {
  createServiceSession, applyStatDelta, estimateStatDelta, parseStatsFromReply, getGirlDelta,
  calcServiceReward, calcGirlStatGrowth, updateGuestSatisfaction, findEligibleTrainers,
  parseActionsFromReply,
} from '@/lib/game-engine'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { GUEST_RACES, GUEST_PERSONALITIES, GUEST_TRAITS } from '@/lib/game-data'
import {
  getSavedGuests, saveGuest, deleteSavedGuest,
  getGuestPreference, saveGuestPreference,
} from '@/lib/storage'
import { Textarea } from '@/components/ui/textarea'

// ─── Preset preference tags ──────────────────────────────────────────────────

const PREF_PRESETS = [
  '正太冒险家', '富裕商人', '神秘精灵', '粗犷武士',
  '温柔骑士', '颓废浪人', '傲慢贵族', '老实农夫',
]

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
  const [guestLoading, setGuestLoading] = useState(false)
  const [session, setSession] = useState<ServiceSession | null>(null)
  const [lastAiMsg, setLastAiMsg] = useState('')
  const [suggestions, setSuggestions] = useState<[string, string, string] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [goldEarned, setGoldEarned] = useState(0)
  // Record stat deltas for result screen: girlId -> { affection, obedience, lewdness }
  const [girlGrowths, setGirlGrowths] = useState<Record<string, { affection: number; obedience: number; lewdness: number }>>({})
  const [openingText, setOpeningText] = useState('')
  const [openingDialogue, setOpeningDialogue] = useState('') // character interaction line
  const [openingLoading, setOpeningLoading] = useState(false)
  const [dialogueLoading, setDialogueLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')

  // Guest preference panel
  const [prefOpen, setPrefOpen] = useState(false)
  const [prefDraft, setPrefDraft] = useState('')
  const [savedGuests, setSavedGuests] = useState<Guest[]>([])
  const [savedGuestsOpen, setSavedGuestsOpen] = useState(false)

  const chatRef = useRef<ChatEngineHandle>(null)
  const eligibleTrainers = findEligibleTrainers(girls)

  // Load persisted preference + saved guests on mount
  useEffect(() => {
    setPrefDraft(getGuestPreference())
    setSavedGuests(getSavedGuests())
  }, [])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const toggleGirl = (id: string) => {
    setSelectedGirls((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const makeRandomGuest = (): Guest => ({
    id: nanoid(),
    name: ['雷克', '阿尔', '马克', '路德', '凯因', '托尔'][Math.floor(Math.random() * 6)],
    race: GUEST_RACES[Math.floor(Math.random() * GUEST_RACES.length)],
    personality: GUEST_PERSONALITIES[Math.floor(Math.random() * GUEST_PERSONALITIES.length)],
    traits: [GUEST_TRAITS[Math.floor(Math.random() * GUEST_TRAITS.length)]],
    desires: '想体验这里的特别服务',
    imageTags: '1man, adventurer, anime, masterpiece, best quality',
    satisfaction: 0,
  })

  const generateGuest = useCallback(async () => {
    setGuestLoading(true)
    try {
      const pref = getGuestPreference()
      const prompt = buildGuestGenerationPrompt(pref, [])
      const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: settings.chatModel, apiKey, stream: false,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const raw: string = data.content ?? data.text ?? ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        setGuest({
          id: nanoid(),
          name: parsed.name ?? '神秘客人',
          race: parsed.race ?? GUEST_RACES[Math.floor(Math.random() * GUEST_RACES.length)],
          personality: parsed.personality ?? GUEST_PERSONALITIES[Math.floor(Math.random() * GUEST_PERSONALITIES.length)],
          traits: parsed.traits ?? [],
          desires: parsed.desires ?? '享受特殊服务',
          imageTags: parsed.imageTags ?? '1man, adventurer, anime, masterpiece',
          satisfaction: 0,
        })
      } else {
        setGuest(makeRandomGuest())
      }
    } catch {
      setGuest(makeRandomGuest())
    } finally {
      setGuestLoading(false)
    }
  }, [settings])

  const handleSaveGuest = () => {
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

  const handleSavePref = () => {
    saveGuestPreference(prefDraft)
    setPrefOpen(false)
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
    const newSession = createServiceSession(type, sessionGirls, {
      guest: type === 'service' && guest ? guest : undefined,
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
      const girlDesc = `${mainGirl.name}（${mainGirl.race}），性格：${mainGirl.personality}，服从度：${mainGirl.obedience}/100，淫乱度：${mainGirl.lewdness}/100`
      const guestDesc = type === 'service' && guest ? `，客人需求：${guest.desires}` : ''
      const sugPrompt = `为以下${type === 'service' ? '服务' : '调教'}场景生成3个玩家可选的开场行动指令。\n魔物娘：${girlDesc}${guestDesc}\n\n要求：\n- 行动1：玩家/客人主动发起（如主动抚摸、命令脱衣、直接进入等），5-12字\n- 行动2：双方互动（如相互撩拨、眼神挑逗、语言调情等），5-12字\n- 行动3：魔物娘主动发起（如她主动靠近、撒娇求抱、主动解衣等），5-12字\n- 贴合角色性格与服从度\n- 只输出JSON数组：["行动1","行动2","行动3"]`
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
        const arr = JSON.parse(match[0]) as string[]
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
    // Parse suggested actions from the reply
    const actions = parseActionsFromReply(rawContent)
    setSuggestions(actions)
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
    for (const girl of session.girls) {
      const before = { affection: girl.affection, obedience: girl.obedience, lewdness: girl.lewdness }
      const growth = calcGirlStatGrowth(girl, session, turnCount)
      updatedGirls = updatedGirls.map((g) => g.id === girl.id ? { ...g, ...growth } : g)
      growths[girl.id] = {
        affection: (growth.affection ?? before.affection) - before.affection,
        obedience: (growth.obedience ?? before.obedience) - before.obedience,
        lewdness: (growth.lewdness ?? before.lewdness) - before.lewdness,
      }
    }
    setGirlGrowths(growths)
    setGoldEarned(earned)
    onSaveChange({
      ...save,
      girls: updatedGirls,
      player: { ...player, gold: player.gold + earned, day: save.currentDay },
    })
    setStep('result')
  }

  const systemPrompt = session ? buildServiceSystemPrompt(player, { ...session, messages }) : ''

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
                  <span className="text-xs font-semibold gold-text flex-1">今日客人</span>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="客人倾向设置"
                    onClick={() => { setPrefOpen(true); setSavedGuestsOpen(false) }}>
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="已保存客人"
                    onClick={() => { setSavedGuestsOpen(true); setPrefOpen(false) }}>
                    <BookOpen className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="保存当前客人"
                    disabled={!guest} onClick={handleSaveGuest}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="重新生成"
                    disabled={guestLoading} onClick={generateGuest}>
                    <RefreshCw className={cn('w-3.5 h-3.5', guestLoading && 'animate-spin')} />
                  </Button>
                </div>

                {/* Guest preference panel */}
                {prefOpen && (
                  <div className="border-b border-border bg-card/50 p-3 space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">客人生成倾向</span>
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setPrefOpen(false)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PREF_PRESETS.map((p) => (
                        <button key={p}
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full border transition-all',
                            prefDraft.includes(p)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          )}
                          onClick={() =>
                            setPrefDraft((d) =>
                              d.includes(p) ? d.replace(p, '').replace(/[,，]\s*$/, '').trim() : d ? `${d}，${p}` : p
                            )
                          }>
                          {p}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={prefDraft}
                      onChange={(e) => setPrefDraft(e.target.value)}
                      placeholder="自定义倾向，例如：喜欢娇小型，不要老人…"
                      className="text-xs resize-none bg-input"
                      rows={2}
                    />
                    <Button size="sm" className="w-full h-7 text-xs glow-btn" onClick={handleSavePref}>
                      保存倾向
                    </Button>
                  </div>
                )}

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

                {/* Guest card area */}
                <div className="flex-1 overflow-y-auto p-3">
                  {guestLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs">生成客人中…</span>
                    </div>
                  ) : guest ? (
                    <GuestCard guest={guest} settings={settings} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <p className="text-xs text-muted-foreground text-center">
                        点击右上角刷新按钮生成今日客人
                      </p>
                      <Button className="glow-btn h-9 px-6 text-sm" onClick={generateGuest}>
                        <RefreshCw className="w-4 h-4 mr-2" />生成客人
                      </Button>
                    </div>
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
                <span className="text-sm font-semibold text-amber-400">{session.guest.satisfaction} / 100</span>
              </div>
            )}
            {type === 'service' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">本次收入</span>
                <span className="text-sm font-semibold gold-text">+{goldEarned} G</span>
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
                  </div>
                )
              })}
            </div>
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
