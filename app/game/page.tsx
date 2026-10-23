'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Trash2 } from 'lucide-react'
import { getGameSave, saveGameSave, getSettings, saveSettings, clearGameSave } from '@/lib/storage'
import { generateDailyGuests, getGuestCapacity } from '@/lib/game-engine'
import { GameSave, AppSettings } from '@/lib/types'
import { migrateSave } from '@/lib/migrate-save'
import { shouldGenerateAiGuests, generateAiGuests, applyAiGuests, isAiEligible } from '@/lib/ai-guests'
import { syncMemory, needsAiSummary, buildGirlSummaryPrompt, generateMemorySummaries, applyMemorySummaries } from '@/lib/girl-memory'
import { speechBrief } from '@/lib/speech-style'
import { fetishPromptLine } from '@/lib/scenes'
import { DailyHub } from '@/components/daily-hub'
import { TrainingFlow } from '@/components/training-flow'
import { ServiceFlow } from '@/components/service-flow'
import { MarketHub, type MarketSub } from '@/components/market-hub'
import { FacilitiesScreen } from '@/components/facilities-screen'
import { FlowsScreen } from '@/components/flows-screen'
import { BottomNav } from '@/components/bottom-nav'
import { SettingsPanel } from '@/components/settings-panel'
import { CheatPanel } from '@/components/cheat-panel'
import { toast } from 'sonner'
import { termsChange } from '@/lib/terms'
import { mmTerms } from '@/lib/terms-mm'
import { setCheat, freeLimits } from '@/lib/cheat'
import { Button } from '@/components/ui/button'

export type GameTab = 'hub' | 'service' | 'training' | 'market' | 'facilities' | 'flows'

/** 已发出的心里话请求（day:girlId），保证每人每天最多一次 */
const summaryInflight = new Set<string>()

export default function GamePage() {
  const router = useRouter()
  const [save, setSave] = useState<GameSave | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<GameTab>('hub')
  const [marketSub, setMarketSub] = useState<MarketSub>('slaves')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cheatOpen, setCheatOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  // Track newly purchased girl to trigger hub dialogue
  const [newlyPurchasedGirl, setNewlyPurchasedGirl] = useState<import('@/lib/types').MonstGirl | null>(null)

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    clearGameSave()
    router.replace('/setup')
  }

  useEffect(() => {
    const s = getGameSave()
    if (!s) { router.replace('/setup'); return }
    // 回填旧存档缺失的日状态字段（行动次数、当日客人池、等级、声望、回头客）
    let migrated = s
    if (
      s.actionsUsedToday === undefined || s.dailyGuests === undefined ||
      s.player.level === undefined || s.player.reputation === undefined || s.regulars === undefined
    ) {
      migrated = {
        ...s,
        player: { ...s.player, level: s.player.level ?? 1, reputation: s.player.reputation ?? 0 },
        actionsUsedToday: s.actionsUsedToday ?? 0,
        regulars: s.regulars ?? [],
        dailyGuests: s.dailyGuests ?? generateDailyGuests(getGuestCapacity(s.player.level), s.player.reputation ?? 0, s.regulars ?? []),
      }
    }
    // 新经营字段（体力、设施、衣橱、敏感带、客人标签…）统一补默认值
    migrated = migrateSave(migrated)
    saveGameSave(migrated)
    setSave(migrated)
    setSettings(getSettings())
    setLoaded(true)
  }, [router])

  // AI 润色当天新客人：先用随机客人（已在存档里），后台请求，回来时只替换仍在客人池里的那几位。
  // 失败/超时静默保留随机客人；无论成败都记 aiGuestsDay，刷新不重复请求。
  const day = save?.currentDay
  // 作弊「解除每日限制」：换来的新客人也会再润色一次
  const freeAiKey = save && freeLimits(save) ? (save.dailyGuests ?? []).filter(isAiEligible).map((g) => g.id).join(',') : ''
  useEffect(() => {
    if (!save || !settings || !shouldGenerateAiGuests(save)) return
    let cancelled = false
    const targetDay = save.currentDay
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    generateAiGuests(save, async (prompt, signal) => {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }) })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json().catch(() => null)
      return String(data?.content ?? '')
    }).catch(() => []).then((upgraded) => {
      if (cancelled) return
      setSave((prev) => {
        if (!prev) return prev
        const next = applyAiGuests(prev, targetDay, upgraded)
        if (next !== prev) saveGameSave(next)
        return next
      })
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, loaded, freeAiKey])

  // 每位魔物娘的「心里话」：新的一天对昨天有新经历的人各请求一次（非流式，同「保存为常客」的请求格式）；
  // 失败保留结束今天时写好的本地版；无论成败都记 aiDay，刷新不重复请求。
  useEffect(() => {
    if (!save || !settings) return
    const targetDay = save.currentDay
    const due = save.girls.filter((g) => needsAiSummary(g, targetDay) && !summaryInflight.has(`${targetDay}:${g.id}`))
    if (!due.length) return
    for (const g of due) summaryInflight.add(`${targetDay}:${g.id}`)  // 严格模式下 effect 会跑两次：同一天同一人只发一次
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const prompts = Object.fromEntries(due.map((g) => [g.id, buildGirlSummaryPrompt(g, save.player, speechBrief(g), fetishPromptLine(g))]))
    generateMemorySummaries(save, prompts, async (prompt) => {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }) })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json().catch(() => null)
      return String(data?.content ?? '')
    }).catch(() => ({})).then((results) => {
      setSave((prev) => {
        if (!prev) return prev
        const next = applyMemorySummaries(prev, targetDay, due.map((g) => g.id), results)
        if (next !== prev) saveGameSave(next)
        return next
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, loaded])

  const handleSaveChange = (updated: GameSave) => {
    // 入馆 / 数值里程碑 / 新事件 → 写进各自的记忆
    const synced = syncMemory(save, updated)
    // 堕落跨档 → 自称 / 对你的称呼永久改口
    for (const g of save ? synced.girls : []) {
      const old = save?.girls.find((x) => x.id === g.id)
      if (!old) continue
      const msg = termsChange(mmTerms(old, { day: save?.currentDay }), mmTerms(g, { day: synced.currentDay }), g.name)
      if (msg) toast('她改口了', { description: msg })
    }
    setSave(synced)
    saveGameSave(synced)
  }

  const handleSettingsChange = (updated: AppSettings) => {
    setSettings(updated)
    saveSettings(updated)
  }

  if (!loaded || !save || !settings) {
    return (
      <div className="h-screen flex items-center justify-center bg-[oklch(0.07_0.01_260)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    /* outer canvas — very dark background */
    <div className="min-h-screen bg-[oklch(0.07_0.01_260)] flex items-center justify-center p-4 sm:p-6">
      {/* centered frame */}
      <div className="relative w-full max-w-2xl h-[92vh] max-h-[860px] rounded-xl overflow-hidden dungeon-frame bg-background flex flex-col">

        {/* tab content fills the frame; bottom nav below */}
        <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'hub' && (
          <DailyHub
            save={save}
            settings={settings}
            onSaveChange={handleSaveChange}
            onNavigate={setActiveTab}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCheat={() => setCheatOpen(true)}
            newlyPurchasedGirl={newlyPurchasedGirl}
            onNewGirlGreeted={() => setNewlyPurchasedGirl(null)}
          />
        )}
        {activeTab === 'service' && (
          <ServiceFlow
            save={save}
            settings={settings}
            onSaveChange={handleSaveChange}
            onBack={() => setActiveTab('hub')}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {activeTab === 'training' && (
          <TrainingFlow save={save} settings={settings} onSaveChange={handleSaveChange} onBack={() => setActiveTab('hub')} onOpenSettings={() => setSettingsOpen(true)} />
        )}
        {activeTab === 'market' && (
          <MarketHub
            save={save}
            settings={settings}
            sub={marketSub}
            onSubChange={setMarketSub}
            onSaveChange={handleSaveChange}
            onBuyGirl={(updated) => {
              // Detect a newly added girl by comparing girl IDs
              const prevIds = new Set(save.girls.map((g) => g.id))
              const added = updated.girls.find((g) => !prevIds.has(g.id))
              if (added) setNewlyPurchasedGirl(added)
              handleSaveChange(updated)
            }}
            onBackToHub={() => setActiveTab('hub')}
          />
        )}
        {activeTab === 'facilities' && (
          <FacilitiesScreen save={save} onSaveChange={handleSaveChange} onOpenScenes={() => { setMarketSub('scenes'); setActiveTab('market') }} />
        )}
        {activeTab === 'flows' && <FlowsScreen save={save} onSaveChange={handleSaveChange} />}

        </div>

        {(activeTab === 'hub' || activeTab === 'market' || activeTab === 'facilities' || activeTab === 'flows') && (
          <BottomNav active={activeTab} onChange={(t) => { if (t === 'market' && activeTab !== 'market') setMarketSub('slaves'); setActiveTab(t) }} />
        )}

        {/* Settings drawer — slides in from right, scoped inside frame */}
        <div
          className={`absolute inset-y-0 right-0 w-96 bg-card border-l border-border flex flex-col z-50 transition-transform duration-300 ease-in-out ${settingsOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-sm font-bold gold-text">设置</h2>
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setSettingsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />
            {/* 作弊 / 调试模式：开关记在存档里（默认关） */}
            <div className="mt-6 rounded-lg border border-rose-900/60 bg-zinc-950/70 p-3 space-y-2" data-testid="settings-cheat">
              <p className="text-[11px] font-semibold tracking-widest text-rose-400">作弊模式（调试用）</p>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={!!save.cheat?.enabled} data-testid="settings-cheat-toggle"
                  onChange={(e) => handleSaveChange(setCheat(save, { enabled: e.target.checked }))} />
                开启作弊（大厅顶栏出现「作弊」入口；记在本存档里）
              </label>
              {save.cheat?.enabled && (
                <button className="h-7 px-2.5 rounded-md border border-rose-800/70 bg-rose-950/40 text-[11px] text-rose-200 hover:bg-rose-900/50" data-testid="settings-cheat-open"
                  onClick={() => { setSettingsOpen(false); setCheatOpen(true) }}>打开作弊面板</button>
              )}
            </div>
          </div>
          {/* 危险操作 — 重置存档 */}
          <div className="shrink-0 border-t border-rose-500/20 p-4">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">危险操作</p>
            <Button
              variant="outline"
              size="sm"
              className={`w-full h-8 text-xs ${confirmReset ? 'border-rose-500 text-rose-400 hover:bg-rose-500/10' : 'border-rose-500/30 text-rose-400/60 hover:border-rose-500 hover:text-rose-400'}`}
              onClick={handleReset}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {confirmReset ? '再次点击确认重置' : '重置存档'}
            </Button>
          </div>
        </div>

        {cheatOpen && save.cheat?.enabled && <CheatPanel save={save} onSaveChange={handleSaveChange} onClose={() => setCheatOpen(false)} />}

        {/* Settings backdrop (inside frame) */}
        {settingsOpen && (
          <div
            className="absolute inset-0 bg-black/40 z-40"
            onClick={() => setSettingsOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
