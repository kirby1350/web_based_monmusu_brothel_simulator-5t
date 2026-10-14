'use client'

import { useEffect, useState } from 'react'
import { Settings, Coins, Calendar, Store, Sword, ShoppingBag, Moon, Zap, Crown, Bed, DoorOpen, BedDouble } from 'lucide-react'
import { GameSave, MonstGirl, AppSettings } from '@/lib/types'
import { ImageDisplay } from '@/components/image-display'
import { GirlSheet } from '@/components/girl-sheet'
import { SkillPicker } from '@/components/skill-picker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MAX_ACTIONS_PER_DAY, getGirlCapacity, getGuestCapacity, getUpgradeCost } from '@/lib/game-engine'
import { endDay, restGirl, upgradeDorm, getDormInfo, pendingSkillPicks } from '@/lib/hub-logic'
import { SERVICE_ROOM_UPGRADE_COSTS, TRAINING_ROOM_UPGRADE_COSTS, getUpgradeCostFor, getPlaySlots, TRAINING_ROOM_MULT, REST_STAMINA } from '@/lib/catalog'
import { clearOpeningCache } from '@/lib/storage'
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

  // 新买的魔物娘：直接打开她的魔物娘页
  useEffect(() => {
    if (!newlyPurchasedGirl) return
    setOpenGirlId(newlyPurchasedGirl.id)
    onNewGirlGreeted?.()
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

  const handleUpgrade = () => {
    const cost = getUpgradeCost(level)
    if (player.gold < cost) return
    onSaveChange({ ...save, player: { ...player, gold: player.gold - cost, level: level + 1 } })
  }
  const handleDorm = () => {
    const r = upgradeDorm(save)
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

      {/* 魔物娘横条 */}
      <div className="border-b border-border px-3 py-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {girls.length === 0 && (
            <button className="text-xs text-muted-foreground px-2 py-3" onClick={() => onNavigate('market')}>馆内还没有魔物娘，去奴隶市场看看 →</button>
          )}
          {girls.map((g) => {
            const st = g.stamina ?? 100
            return (
              <button key={g.id} data-testid={`girl-${g.name}`} onClick={() => restPicking ? handleRest(g.id) : setOpenGirlId(g.id)}
                className={cn('w-16 shrink-0 rounded-lg border bg-card p-1 text-left transition-colors',
                  restPicking ? 'border-emerald-400/60 hover:bg-emerald-400/10' : 'border-border hover:border-primary/50')}>
                <div className="relative w-full aspect-square rounded-md overflow-hidden">
                  <ImageDisplay tags={g.imageTags} settings={settings} cachedUrl={g.imageUrl}
                    onUrlCached={(url) => onSaveChange({ ...save, girls: girls.map((x) => x.id === g.id ? { ...x, imageUrl: url } : x) })}
                    alt={g.name} className="w-full h-full object-cover" />
                  {appeared.has(g.id) && <span className="absolute top-0 right-0 text-[8px] bg-black/70 text-amber-300 px-1 rounded-bl">已出场</span>}
                  {pendingSkillPicks(g) > 0 && <span className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-amber-400" />}
                </div>
                <p className="text-[10px] truncate mt-0.5 gold-text">{g.name}</p>
                <div className="h-1 rounded-full bg-secondary overflow-hidden" title={`体力 ${st}`}>
                  <div className={cn('h-full', st >= 50 ? 'bg-emerald-400' : st >= 25 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: `${st}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground" data-testid={`stamina-${g.name}`}>体力 {st}</p>
              </button>
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
              cost={getUpgradeCost(level)} gold={player.gold} onUpgrade={handleUpgrade} testId="upgrade-brothel" />
            <FacilityCard icon={BedDouble} title={`宿舍 · ${dorm.name}`} level={dorm.level}
              desc={`每晚体力 +${dorm.nightly}${dorm.clearsExhaustion ? '，解除疲惫' : ''}${dorm.bestBedBonus ? `，指定一人再 +${dorm.bestBedBonus}` : ''}`}
              cost={dorm.upgradeCost} gold={player.gold} onUpgrade={handleDorm} testId="upgrade-dorm" />
            <FacilityCard icon={DoorOpen} title="服务房间" level={roomLv} desc={`额外 play 槽 ${getPlaySlots(roomLv)}`}
              cost={roomCost} gold={player.gold} locked testId="upgrade-room" />
            <FacilityCard icon={Sword} title="调教室" level={trainLv} desc={`收益倍率 ×${TRAINING_ROOM_MULT[trainLv - 1]}`}
              cost={trainCost} gold={player.gold} locked testId="upgrade-training" />
            <Button variant="outline" size="sm" className="col-span-2 h-8 text-xs" onClick={() => onNavigate('market')}>
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />前往奴隶市场
            </Button>
          </TabsContent>

          <TabsContent value="shop" className="space-y-2 mt-0">
            <p className="text-xs text-muted-foreground">恢复药、塑形药、衣橱和调教道具即将上架。</p>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => onNavigate('market')}>
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />前往奴隶市场
            </Button>
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
        <GirlSheet key={openGirl.id} girl={openGirl} save={save} settings={settings} onSaveChange={onSaveChange} onClose={() => setOpenGirlId(null)} />
      )}
    </div>
  )
}

function FacilityCard({ icon: Icon, title, level, desc, cost, gold, onUpgrade, locked, testId }: {
  icon: typeof Store; title: string; level: number; desc: string; cost: number | null; gold: number
  onUpgrade?: () => void; locked?: boolean; testId?: string
}) {
  const can = !locked && cost !== null && gold >= cost
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold">{title}</span>
        <span className="flex-1" />
        <span className="text-[10px] gold-text">Lv.{level}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug flex-1">{desc}</p>
      <button data-testid={testId} disabled={!can} onClick={onUpgrade}
        className={cn('text-[10px] rounded-md border px-2 py-1 transition-colors',
          can ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/50 cursor-not-allowed')}>
        {cost === null ? '已满级' : locked ? `升级 ${cost}G（即将开放）` : `升级 ${cost}G`}
      </button>
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
