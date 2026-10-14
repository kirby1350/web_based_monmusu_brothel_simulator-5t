'use client'

import { useEffect, useState } from 'react'
import { Settings, Coins, Calendar, Store, Sword, ShoppingBag, Moon, Zap, Crown, Bed, DoorOpen, BedDouble } from 'lucide-react'
import { GameSave, MonstGirl, AppSettings } from '@/lib/types'
import { ImageDisplay } from '@/components/image-display'
import { GirlSheet } from '@/components/girl-sheet'
import { StepActionsEditor } from '@/components/step-actions-editor'
import { getStepActions } from '@/lib/custom-props'
import { SkillPicker } from '@/components/skill-picker'
import { ShopPanel } from '@/components/shop-panel'
import { upgradeServiceRoom, upgradeTrainingRoom } from '@/lib/shop'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MAX_ACTIONS_PER_DAY, getGirlCapacity, getGuestCapacity, getUpgradeCost } from '@/lib/game-engine'
import { endDay, restGirl, upgradeDorm, getDormInfo, pendingSkillPicks, pickArrivalLeader, arrivalFallbackText, arrivalPromptNote, setBestBed, bannerPath, shortfallText, upgradeChangeText, type FacilityKey } from '@/lib/hub-logic'
import { SERVICE_ROOM_UPGRADE_COSTS, TRAINING_ROOM_UPGRADE_COSTS, getUpgradeCostFor, getPlaySlots, TRAINING_ROOM_MULT, TRAINING_ROOM_PROP_SLOTS, REST_STAMINA } from '@/lib/catalog'
import { clearOpeningCache, getOpeningCache, saveOpeningCache } from '@/lib/storage'
import { contextImageTags, hubOpeningPrompt } from '@/lib/prompt-context'
import { dismissDaySummary } from '@/lib/day-summary'
import { TUTORIAL_STEPS, isTutorialVisible, advanceTutorial, dismissTutorial } from '@/lib/tutorial'
import { cn } from '@/lib/utils'
import type { GameTab } from '@/app/game/page'

interface DailyHubProps {
  save: GameSave
  settings: AppSettings
  onSaveChange: (save: GameSave) => void
  onNavigate: (tab: GameTab) => void
  onOpenSettings: () => void
  newlyPurchasedGirl?: MonstGirl | null
  onNewGirlGreeted?: () => void
}

const KIND_LABEL: Record<string, string> = { M: '想施虐 · M 性对口', S: '想被榨 · S 性对口', 中性: '中性' }

export function DailyHub({ save, settings, onSaveChange, onNavigate, onOpenSettings, newlyPurchasedGirl, onNewGirlGreeted }: DailyHubProps) {
  const { player, girls } = save
  const [openGirlId, setOpenGirlId] = useState<string | null>(null)
  const [restPicking, setRestPicking] = useState(false)
  const [notice, setNotice] = useState('')
  const [dismissedPicks, setDismissedPicks] = useState<string[]>([])

  const [intro, setIntro] = useState<{ girlId: string; speaker: string; text: string; loading: boolean } | null>(null)

  // 新买的魔物娘：打开她的魔物娘页，并由好感最高（≥50）的魔物娘或馆主带她入馆
  // 第 2 天起的开场白：懒加载、按天缓存；模型不可用时静默不显示
  const [opening, setOpening] = useState<string>(() => { const c = getOpeningCache(); return c && c.day === save.currentDay ? c.text : '' })
  useEffect(() => {
    let ignore = false
    const cache = getOpeningCache()
    if (cache?.day === save.currentDay) { setOpening(cache.text); return }
    setOpening('')
    const timer = setTimeout(async () => {
      try {
        const prompt = await hubOpeningPrompt(save, cache?.day ?? null)
        if (!prompt || ignore) return
        const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }) })
        const data = res.ok ? await res.json().catch(() => null) : null
        const text = String(data?.content ?? '').trim()
        // 失败也记一笔空缓存：当天不再重试，避免每次回大厅都报一次 500
        saveOpeningCache(save.currentDay, text)
        if (text && !ignore) setOpening(text)
      } catch { saveOpeningCache(save.currentDay, '') /* 离线：静默不显示开场白 */ }
    }, 800)
    return () => { ignore = true; clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.currentDay])

  useEffect(() => {
    if (!newlyPurchasedGirl) return
    const ng = newlyPurchasedGirl
    setOpenGirlId(ng.id)
    onNewGirlGreeted?.()
    const leader = pickArrivalLeader(save.girls, ng.id)
    const speaker = leader.kind === 'girl' ? leader.girl.name : save.player.name
    const fallback = arrivalFallbackText(leader, save.player.name, ng)
    setIntro({ girlId: ng.id, speaker, text: '', loading: true })
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const prompt = `${arrivalPromptNote(leader, save.player.name, ng)}\n新人：${ng.name}（${ng.race}，性格：${ng.personality}）。用中文写一段80~150字的入馆场景，含两三句对白。只输出正文，不要输出数据块。`
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
    })
      .then(async (r) => (r.ok ? ((await r.json()).content ?? '').trim() : ''))
      .catch(() => '')
      .then((text: string) => setIntro({ girlId: ng.id, speaker, text: text || fallback, loading: false }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyPurchasedGirl])

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  const actionsUsed = save.actionsUsedToday ?? 0
  const actionsLeft = Math.max(0, MAX_ACTIONS_PER_DAY - actionsUsed)
  const noActionsLeft = actionsLeft <= 0
  const level = player.level ?? 1
  const girlCap = getGirlCapacity(level)
  const guests = save.dailyGuests ?? []
  const appeared = new Set(save.appearedToday ?? [])
  const openGirl = girls.find((g) => g.id === openGirlId) ?? null
  const pickGirl = girls.find((g) => pendingSkillPicks(g) > 0 && !dismissedPicks.includes(g.id) && g.id !== openGirlId)

  const [lit, setLit] = useState<FacilityKey | null>(null)
  const celebrate = (k: FacilityKey, from: number, to: number) => {
    flash(upgradeChangeText(k, from, to))
    setLit(k); setTimeout(() => setLit((x) => (x === k ? null : x)), 1600)
  }
  const handleUpgrade = () => {
    const cost = getUpgradeCost(level)
    if (player.gold < cost) return
    onSaveChange({ ...save, player: { ...player, gold: player.gold - cost, level: level + 1 } })
    celebrate('brothel', level, level + 1)
  }
  const handleDorm = () => {
    const from = getDormInfo(player.dormLevel).level
    const r = upgradeDorm(save)
    if (r.ok) { onSaveChange(r.save); celebrate('dorm', from, from + 1) } else flash(r.error)
  }
  const handleRoom = (kind: 'service' | 'training') => {
    const from = kind === 'service' ? roomLv : trainLv
    const r = kind === 'service' ? upgradeServiceRoom(save) : upgradeTrainingRoom(save)
    if (r.ok) { onSaveChange(r.save); celebrate(kind, from, from + 1) } else flash(r.error)
  }
  const handleBestBed = (id: string) => {
    const r = setBestBed(save, id || null)
    if (r.ok) { onSaveChange(r.save); flash(r.message) } else flash(r.error)
  }
  const handleRest = (girlId: string) => {
    const r = restGirl(save, girlId)
    setRestPicking(false)
    if (r.ok) { onSaveChange(r.save); flash(r.message) } else flash(r.error)
  }
  const handleEndDay = () => {
    clearOpeningCache()
    onSaveChange(endDay(save))
    flash(`第 ${save.currentDay + 1} 天开始了，宿舍让大家恢复了体力`)
  }

  const dorm = getDormInfo(player.dormLevel)
  const roomLv = player.serviceRoomLevel ?? 1
  const trainLv = player.trainingRoomLevel ?? 1
  const roomCost = getUpgradeCostFor(SERVICE_ROOM_UPGRADE_COSTS, roomLv)
  const trainCost = getUpgradeCostFor(TRAINING_ROOM_UPGRADE_COSTS, trainLv)

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* 顶栏：天数 / 金币 / 剩余行动 */}
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="day">
          <Calendar className="w-3.5 h-3.5" />第 {save.currentDay} 天
        </span>
        <span className="flex items-center gap-1.5" data-testid="gold">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs gold-text font-semibold">{player.gold} G</span>
        </span>
        <span className={cn('flex items-center gap-1 text-xs', noActionsLeft ? 'text-rose-400' : 'text-emerald-300')} data-testid="actions">
          <Zap className="w-3.5 h-3.5" />行动 {actionsLeft}/{MAX_ACTIONS_PER_DAY}
        </span>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onOpenSettings}>
          <Settings className="w-4 h-4" />
        </Button>
      </header>

      {/* 昨日小结（结束今天后弹出，关闭即清空） */}
      {save.lastDaySummary && (() => {
        const d = save.lastDaySummary
        const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
        return (
          <div className="absolute inset-0 z-30 bg-black/60 flex items-start justify-center pt-16 px-4" data-testid="day-summary" onClick={() => onSaveChange(dismissDaySummary(save))}>
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold gold-text">第 {d.day} 天小结</span>
                <span className="text-muted-foreground">声望 {sign(d.repDelta)}</span>
              </div>
              <p>收入 <span className="gold-text font-semibold">{d.income} G</span>{d.spent ? <span className="text-muted-foreground">　支出 {d.spent} G</span> : null}</p>
              <p>接客 {Object.values(d.tiers).reduce((a, b) => a + b, 0)} 场{Object.keys(d.tiers).length ? '：' + Object.entries(d.tiers).map(([k, v]) => `${k}×${v}`).join('、') : ''}</p>
              {d.best && <p>最佳：{d.best.girl}（{d.best.sat}，{d.best.guest}）</p>}
              {d.regulars.length > 0 && <p>回头客：{d.regulars.map((r) => `${r.guest}${r.rolled ? '✔' : `（${r.sat}，差一点）`}`).join('、')}</p>}
              {d.incidents.length > 0 && <p className="text-rose-300">事件：{d.incidents.map((x) => `${x.status === '已处理' ? '✔已处理 ' : ''}${x.girl}${x.kind}·${x.text}`).join('；')}</p>}
              {!!d.unresolved && <p className="text-rose-300/70">仍有 {d.unresolved} 件旧事件未处理</p>}
              {d.stats.length > 0 && <p className="text-muted-foreground">{d.stats.map((x) => `${x.girl} ${[x.ob && `服${sign(x.ob)}`, x.lw && `淫${sign(x.lw)}`, x.aff && `好${sign(x.aff)}`].filter(Boolean).join(' ')}`).join('｜')}</p>}
              <div className="flex justify-end pt-1">
                <button className="text-primary font-semibold" data-testid="day-summary-close" onClick={() => onSaveChange(dismissDaySummary(save))}>知道了</button>
              </div>
            </div>
          </div>
        )
      })()}

      {opening && <p className="mx-3 mt-2 text-[11px] italic text-muted-foreground leading-relaxed shrink-0" data-testid="hub-opening">{opening}</p>}

      {/* 第一天新手引导（可跳过，进度存档） */}
      {isTutorialVisible(save) && (() => {
        const i = Math.min(save.tutorial!.step, TUTORIAL_STEPS.length - 1)
        const st = TUTORIAL_STEPS[i]
        const last = i === TUTORIAL_STEPS.length - 1
        return (
          <div className="mx-3 mt-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 shrink-0" data-testid="tutorial">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">{st.title}</span>
              <span className="text-[10px] text-muted-foreground">{i + 1}/{TUTORIAL_STEPS.length}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{st.body}</p>
            <div className="flex justify-end gap-2 mt-1.5">
              {!last && <button className="text-[11px] text-muted-foreground hover:text-foreground" data-testid="tutorial-skip" onClick={() => onSaveChange(dismissTutorial(save))}>跳过引导</button>}
              <button className="text-[11px] text-primary font-semibold" data-testid="tutorial-next" onClick={() => onSaveChange(advanceTutorial(save))}>{last ? '开始经营' : '下一步 →'}</button>
            </div>
          </div>
        )
      })()}

      {/* 魔物娘横条 */}
      <div className="border-b border-border px-3 py-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {girls.length === 0 && (
            <button className="text-xs text-muted-foreground px-2 py-3" onClick={() => onNavigate('market')}>馆内还没有魔物娘，去奴隶市场看看 →</button>
          )}
          {girls.map((g) => {
            const st = g.stamina ?? 100
            return (
              <div key={g.id} role="button" tabIndex={0} data-testid={`girl-${g.name}`} onClick={() => restPicking ? handleRest(g.id) : setOpenGirlId(g.id)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (restPicking) { handleRest(g.id) } else { setOpenGirlId(g.id) } } }}
                className={cn('w-16 shrink-0 rounded-lg border bg-card p-1 text-left transition-colors cursor-pointer',
                  restPicking ? 'border-emerald-400/60 hover:bg-emerald-400/10' : 'border-border hover:border-primary/50')}>
                <div className="relative w-full aspect-square rounded-md overflow-hidden">
                  <ImageDisplay tags={contextImageTags(g, { exhausted: g.exhausted || (g.stamina ?? 100) < 30, incident: !!g.incident })} settings={settings} cachedUrl={g.imageUrl}
                    onUrlCached={(url) => onSaveChange({ ...save, girls: girls.map((x) => x.id === g.id ? { ...x, imageUrl: url } : x) })}
                    alt={g.name} className="w-full h-full object-cover" />
                  {appeared.has(g.id) && <span className="absolute top-0 right-0 text-[8px] bg-black/70 text-amber-300 px-1 rounded-bl">已出场</span>}
                  {pendingSkillPicks(g) > 0 && <span className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-amber-400" />}
                  {g.incident && <span data-testid={`incident-mark-${g.name}`} title={`${g.incident.kind}：${g.incident.text}`} className="absolute bottom-0 left-0 text-[8px] bg-rose-600/85 text-white px-1 rounded-tr">{g.incident.kind === '闯祸' ? '闯祸' : '失败'}</span>}
                </div>
                <p className="text-[10px] truncate mt-0.5 gold-text">{g.name}</p>
                <div className="h-1 rounded-full bg-secondary overflow-hidden" title={`体力 ${st}`}>
                  <div className={cn('h-full', st >= 50 ? 'bg-emerald-400' : st >= 25 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: `${st}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground" data-testid={`stamina-${g.name}`}>体力 {st}</p>
              </div>
            )
          })}
        </div>
        {restPicking && (
          <p className="text-[10px] text-emerald-300 mt-1">选择要休息的魔物娘（体力 +{REST_STAMINA}，占 1 次行动）
            <button className="ml-2 underline text-muted-foreground" onClick={() => setRestPicking(false)}>取消</button></p>
        )}
      </div>

      {notice && <div className="mx-4 mt-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-xs text-primary" data-testid="notice">{notice}</div>}

      {pickGirl && (
        <div className="mx-4 mt-2">
          <SkillPicker girl={pickGirl} onPicked={(g) => onSaveChange({ ...save, girls: girls.map((x) => x.id === g.id ? g : x) })} />
          <button className="text-[10px] text-muted-foreground underline mt-1" onClick={() => setDismissedPicks((d) => [...d, pickGirl.id])}>稍后再选</button>
        </div>
      )}

      {/* 三页：今日客人 / 设施 / 商店 */}
      <Tabs defaultValue="guests" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-4 mt-2 shrink-0">
          <TabsTrigger value="guests" className="text-xs">今日客人（{guests.length}）</TabsTrigger>
          <TabsTrigger value="facilities" className="text-xs">设施</TabsTrigger>
          <TabsTrigger value="shop" className="text-xs">商店</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <TabsContent value="guests" className="space-y-2 mt-0" data-testid="guest-list">
            {guests.length === 0 && <p className="text-xs text-muted-foreground">今天的客人都接待完了。</p>}
            {guests.map((gu) => (
              <div key={gu.id} className="rounded-lg border border-border bg-card px-3 py-2 space-y-1" data-testid="guest-card">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold gold-text">{gu.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{gu.race}</Badge>
                  {(gu.visits ?? 0) > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-pink-500/15 text-pink-300">回头客</Badge>}
                  <span className="flex-1" />
                  <span className="text-[10px] gold-text">预算 {gu.budget ?? 80}G</span>
                </div>
                <p className="text-[11px] text-foreground/80">{gu.desires}</p>
                <div className="flex flex-wrap gap-1 text-[9px]">
                  {gu.desireService && <Badge variant="secondary" className="text-[9px] h-4 px-1">主需求 {gu.desireService}</Badge>}
                  {gu.desireKind && <Badge variant="secondary" className="text-[9px] h-4 px-1">{KIND_LABEL[gu.desireKind]}</Badge>}
                  {gu.prefOutfit && <Badge variant="secondary" className="text-[9px] h-4 px-1">服装喜好 {gu.prefOutfit}</Badge>}
                  {gu.prefRace && <Badge variant="secondary" className="text-[9px] h-4 px-1">偏好 {gu.prefRace}</Badge>}
                  {gu.prefTrait && <Badge variant="secondary" className="text-[9px] h-4 px-1">偏好 {gu.prefTrait}</Badge>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="facilities" className="grid grid-cols-2 gap-2 mt-0">
            <FacilityCard icon={Crown} title="娼馆" level={level} desc={`魔物娘 ${girls.length}/${girlCap} · 每日客人 ${getGuestCapacity(level)}`}
              cost={getUpgradeCost(level)} gold={player.gold} onUpgrade={handleUpgrade} testId="upgrade-brothel"
              banner={bannerPath('brothel', level)} flash={lit === 'brothel'} />
            <FacilityCard icon={BedDouble} title={`宿舍 · ${dorm.name}`} level={dorm.level}
              desc={`每晚体力 +${dorm.nightly}${dorm.clearsExhaustion ? '，解除疲惫' : ''}${dorm.bestBedBonus ? `，指定一人再 +${dorm.bestBedBonus}` : ''}`}
              cost={dorm.upgradeCost} gold={player.gold} onUpgrade={handleDorm} testId="upgrade-dorm"
              banner={bannerPath('dorm', dorm.level)} flash={lit === 'dorm'}>
              {dorm.bestBedBonus ? (
                <select data-testid="best-bed" value={save.bestBedGirlId ?? ''} onChange={(e) => handleBestBed(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[10px]">
                  <option value="">指定床位：无</option>
                  {girls.map((g) => <option key={g.id} value={g.id}>指定床位：{g.name}</option>)}
                </select>
              ) : null}
            </FacilityCard>
            <FacilityCard icon={DoorOpen} title="服务房间" level={roomLv} desc={`额外 play 槽 ${getPlaySlots(roomLv)}`}
              cost={roomCost} gold={player.gold} onUpgrade={() => handleRoom('service')} testId="upgrade-room"
              banner={bannerPath('service', roomLv)} flash={lit === 'service'} />
            <FacilityCard icon={Sword} title="调教室" level={trainLv} desc={`收益倍率 ×${TRAINING_ROOM_MULT[trainLv - 1]} · 道具槽 ${TRAINING_ROOM_PROP_SLOTS[trainLv - 1]}`}
              cost={trainCost} gold={player.gold} onUpgrade={() => handleRoom('training')} testId="upgrade-training"
              banner={bannerPath('training', trainLv)} flash={lit === 'training'} />
            <Button variant="outline" size="sm" className="col-span-2 h-8 text-xs" onClick={() => onNavigate('market')}>
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />前往奴隶市场
            </Button>
            <StepActionsEditor title="标准做法（全馆）" testId="hub-step-actions" value={player.stepActions}
              placeholders={getStepActions()}
              onSave={(v) => { onSaveChange({ ...save, player: { ...player, stepActions: v } }); flash(v ? '已更新全馆标准做法' : '全馆标准做法已恢复默认') }} />
          </TabsContent>

          <TabsContent value="shop" className="mt-0">
            <ShopPanel save={save} onSaveChange={onSaveChange} onOpenMarket={() => onNavigate('market')} />
          </TabsContent>
        </div>
      </Tabs>

      {/* 底部四个按钮 */}
      <div className="border-t border-border px-4 py-2 shrink-0">
        {noActionsLeft && <p className="text-[10px] text-rose-400/80 text-center mb-1.5">今日行动已用尽，点击「结束今天」进入下一天</p>}
        <div className="grid grid-cols-4 gap-2">
          <ActionButton icon={Store} label="接客" color="primary" onClick={() => onNavigate('service')}
            disabled={girls.length === 0 || noActionsLeft || guests.length === 0} />
          <ActionButton icon={Sword} label="调教" color="rose" onClick={() => onNavigate('training')}
            disabled={girls.length === 0 || noActionsLeft} />
          <ActionButton icon={Bed} label="休息" color="emerald" onClick={() => setRestPicking((v) => !v)}
            disabled={girls.length === 0 || noActionsLeft} testId="btn-rest" />
          <ActionButton icon={Moon} label="结束今天" color="amber" onClick={handleEndDay} testId="btn-endday" />
        </div>
      </div>

      {openGirl && (
        <GirlSheet key={openGirl.id} girl={openGirl} save={save} settings={settings} onSaveChange={onSaveChange} onClose={() => { setOpenGirlId(null); setIntro(null) }} intro={intro && intro.girlId === openGirl.id ? intro : null} />
      )}
    </div>
  )
}

function FacilityCard({ icon: Icon, title, level, desc, cost, gold, onUpgrade, locked, testId, banner, flash, children }: {
  icon: typeof Store; title: string; level: number; desc: string; cost: number | null; gold: number
  onUpgrade?: () => void; locked?: boolean; testId?: string; banner?: string; flash?: boolean; children?: React.ReactNode
}) {
  const can = !locked && cost !== null && gold >= cost
  const [bannerOk, setBannerOk] = useState(true)
  const short = locked ? '' : shortfallText(cost, gold)
  return (
    <div data-testid={testId ? `${testId}-card` : undefined}
      className={cn('rounded-xl border bg-card overflow-hidden flex flex-col transition-shadow duration-700',
        flash ? 'border-amber-400 shadow-[0_0_14px_oklch(0.78_0.18_85/0.55)]' : 'border-border')}>
      {banner && bannerOk && (
        <div className="relative h-10 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={banner} src={banner} alt="" data-testid={testId ? `${testId}-banner` : undefined} onError={() => setBannerOk(false)}
            className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-500" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-card" />
        </div>
      )}
      <div className="p-3 pt-2 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold">{title}</span>
          <span className="flex-1" />
          <span className="text-[10px] gold-text">Lv.{level}</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug flex-1">{desc}</p>
        {children}
        <button data-testid={testId} disabled={!can} onClick={onUpgrade}
          className={cn('text-[10px] rounded-md border px-2 py-1 transition-colors',
            can ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/50 cursor-not-allowed')}>
          {cost === null ? '已满级' : locked ? `升级 ${cost}G（即将开放）` : `升级 ${cost}G`}
        </button>
        {short && <p className="text-[10px] text-rose-400/80 text-center" data-testid={testId ? `${testId}-short` : undefined}>{short}</p>}
      </div>
    </div>
  )
}

function ActionButton({ icon: Icon, label, color, onClick, disabled, testId }: {
  icon: typeof Store
  label: string
  color: 'primary' | 'rose' | 'amber' | 'emerald'
  onClick: () => void
  disabled?: boolean
  testId?: string
}) {
  const c = {
    primary: 'bg-primary/10 hover:bg-primary/20 border-primary/30 hover:border-primary/60 text-primary',
    rose: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 hover:border-rose-500/60 text-rose-400',
    amber: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-500/60 text-amber-400',
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400',
  }[color]
  return (
    <button data-testid={testId}
      className={cn('flex items-center justify-center gap-1.5 rounded-xl border py-2.5 transition-all duration-150 text-xs font-medium', c, disabled && 'opacity-40 pointer-events-none')}
      onClick={onClick} disabled={disabled}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
