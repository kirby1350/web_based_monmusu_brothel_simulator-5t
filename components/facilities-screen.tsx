'use client'

// 设施页：四项升级（点升级先看变化再确认）+ 今晚安排（指定床位 / 机械挂机）+ 已有调教场景与维护费
import { useState } from 'react'
import { Coins, Store, Sword, Crown, DoorOpen, BedDouble, Moon } from 'lucide-react'
import { GameSave } from '@/lib/types'
import { BottomSheet } from '@/components/bottom-sheet'
import { upgradeServiceRoom, upgradeTrainingRoom } from '@/lib/shop'
import { getGirlCapacity, getGuestCapacity, getUpgradeCost } from '@/lib/game-engine'
import { upgradeDorm, getDormInfo, setBestBed, setMachineNight, bannerPath, shortfallText, upgradeChangeText, type FacilityKey } from '@/lib/hub-logic'
import { getScene, sceneUpkeep, ownsScene, MACHINE_NIGHT_OBEDIENCE, DIRECTION_LABEL } from '@/lib/scenes'
import { SERVICE_ROOM_UPGRADE_COSTS, TRAINING_ROOM_UPGRADE_COSTS, getUpgradeCostFor, getPlaySlots, TRAINING_ROOM_MULT, TRAINING_ROOM_PROP_SLOTS } from '@/lib/catalog'
import { cn } from '@/lib/utils'

const FACILITY_NAME: Record<FacilityKey, string> = { brothel: '娼馆', dorm: '宿舍', service: '服务房间', training: '调教室' }

export function FacilitiesScreen({ save, onSaveChange, onOpenScenes }: { save: GameSave; onSaveChange: (s: GameSave) => void; onOpenScenes: () => void }) {
  const { player, girls } = save
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<FacilityKey | null>(null)
  const [lit, setLit] = useState<FacilityKey | null>(null)
  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  const level = player.level ?? 1
  const dorm = getDormInfo(player.dormLevel)
  const roomLv = player.serviceRoomLevel ?? 1
  const trainLv = player.trainingRoomLevel ?? 1
  const appeared = new Set(save.appearedToday ?? [])
  const info: Record<FacilityKey, { lv: number; cost: number | null }> = {
    brothel: { lv: level, cost: getUpgradeCost(level) },
    dorm: { lv: dorm.level, cost: dorm.upgradeCost },
    service: { lv: roomLv, cost: getUpgradeCostFor(SERVICE_ROOM_UPGRADE_COSTS, roomLv) },
    training: { lv: trainLv, cost: getUpgradeCostFor(TRAINING_ROOM_UPGRADE_COSTS, trainLv) },
  }

  const doUpgrade = (k: FacilityKey) => {
    setConfirm(null)
    const from = info[k].lv
    let r: { ok: true; save: GameSave } | { ok: false; error: string }
    if (k === 'brothel') {
      const cost = getUpgradeCost(level)
      r = player.gold < cost ? { ok: false, error: '金币不足' } : { ok: true, save: { ...save, player: { ...player, gold: player.gold - cost, level: level + 1 } } }
    } else if (k === 'dorm') r = upgradeDorm(save)
    else r = k === 'service' ? upgradeServiceRoom(save) : upgradeTrainingRoom(save)
    if (!r.ok) { flash(r.error); return }
    onSaveChange(r.save)
    flash(upgradeChangeText(k, from, from + 1))
    setLit(k); setTimeout(() => setLit((x) => (x === k ? null : x)), 1600)
  }
  const handleBestBed = (id: string) => {
    const r = setBestBed(save, id || null)
    if (r.ok) { onSaveChange(r.save); flash(r.message) } else flash(r.error)
  }
  const handleMachineNight = (id: string) => {
    const r = setMachineNight(save, id || null)
    if (r.ok) { onSaveChange(r.save); flash(r.message) } else flash(r.error)
  }

  const owned = player.ownedScenes ?? []
  const card = (k: FacilityKey, icon: typeof Store, title: string, desc: string) => (
    <FacilityCard icon={icon} title={title} level={info[k].lv} desc={desc} cost={info[k].cost} gold={player.gold}
      onUpgrade={() => setConfirm(k)} testId={`upgrade-${k === 'brothel' ? 'brothel' : k === 'dorm' ? 'dorm' : k === 'service' ? 'room' : 'training'}`}
      banner={bannerPath(k, info[k].lv)} flash={lit === k} />
  )

  return (
    <div className="flex flex-col h-full bg-background relative" data-testid="facilities">
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-bold gold-text">设施</h1>
        <span className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs gold-text font-semibold">{player.gold} G</span></span>
      </header>
      {notice && <div className="mx-4 mt-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-xs text-primary" data-testid="notice">{notice}</div>}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {card('brothel', Crown, '娼馆', `魔物娘 ${girls.length}/${getGirlCapacity(level)} · 每日客人 ${getGuestCapacity(level)}`)}
          {card('dorm', BedDouble, `宿舍 · ${dorm.name}`, `每晚体力 +${dorm.nightly}${dorm.clearsExhaustion ? '，解除疲惫' : ''}${dorm.bestBedBonus ? `，指定一人再 +${dorm.bestBedBonus}` : ''}`)}
          {card('service', DoorOpen, '服务房间', `额外 play 槽 ${getPlaySlots(roomLv)}`)}
          {card('training', Sword, '调教室', `收益倍率 ×${TRAINING_ROOM_MULT[trainLv - 1]} · 道具槽 ${TRAINING_ROOM_PROP_SLOTS[trainLv - 1]}`)}
        </div>

        {/* 今晚安排 */}
        <section className="rounded-lg border border-border bg-card px-3 py-2 space-y-1.5" data-testid="tonight">
          <p className="text-xs font-semibold gold-text flex items-center gap-1.5"><Moon className="w-3.5 h-3.5" />今晚安排</p>
          {dorm.bestBedBonus ? (
            <select data-testid="best-bed" value={save.bestBedGirlId ?? ''} onChange={(e) => handleBestBed(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[11px]">
              <option value="">指定床位：无</option>
              {girls.map((g) => <option key={g.id} value={g.id}>指定床位：{g.name}（再 +{dorm.bestBedBonus}）</option>)}
            </select>
          ) : <p className="text-[10px] text-muted-foreground">宿舍再升级后可以指定一人睡最好的床。</p>}
          {ownsScene(save, 'machine') ? (
            <select data-testid="machine-night" value={save.machineNightGirlId ?? ''} onChange={(e) => handleMachineNight(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[11px]">
              <option value="">今晚机械挂机：无</option>
              {girls.filter((g) => !appeared.has(g.id)).map((g) => <option key={g.id} value={g.id}>今晚机械挂机：{g.name}（服从 +{MACHINE_NIGHT_OBEDIENCE}，体力恢复减半）</option>)}
            </select>
          ) : <p className="text-[10px] text-muted-foreground">买下「机械调教室」后可安排夜间挂机。</p>}
        </section>

        {/* 已有调教场景 */}
        <section className="rounded-lg border border-border bg-card px-3 py-2 space-y-1.5" data-testid="hub-scenes">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold gold-text">调教场景（{owned.length}）</p>
            <p className="text-[10px] text-muted-foreground">维护 {sceneUpkeep(player)} G/天（结束今天时扣）</p>
          </div>
          {owned.length === 0 && <p className="text-[10px] text-muted-foreground">还没有场景。</p>}
          {owned.map((id) => {
            const sc = getScene(id)!
            return (
              <div key={id} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1">{sc.name} <span className="text-[10px] text-muted-foreground">{sc.directions.map((d) => DIRECTION_LABEL[d]).join('/')}</span></span>
                <span className="text-[10px] text-muted-foreground">{sc.upkeep}G/天</span>
              </div>
            )
          })}
          <button className="text-[11px] text-amber-400 underline" onClick={onOpenScenes} data-testid="goto-scenes">去市场看更多场景 →</button>
        </section>
      </div>

      <BottomSheet open={!!confirm} onClose={() => setConfirm(null)} testId="upgrade-sheet"
        title={confirm && `升级${FACILITY_NAME[confirm]}到 Lv.${info[confirm].lv + 1}`}>
        {confirm && (
          <>
            <p className="text-xs text-foreground/85" data-testid="upgrade-preview">{upgradeChangeText(confirm, info[confirm].lv, info[confirm].lv + 1)}</p>
            <p className="text-[11px] text-muted-foreground">花费 {info[confirm].cost} G（现有 {player.gold} G）</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button className="h-9 text-xs rounded-lg border border-border" onClick={() => setConfirm(null)}>再想想</button>
              <button className="h-9 text-xs rounded-lg bg-primary text-primary-foreground" data-testid="upgrade-confirm" onClick={() => doUpgrade(confirm)}>确认升级</button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  )
}

function FacilityCard({ icon: Icon, title, level, desc, cost, gold, onUpgrade, testId, banner, flash }: {
  icon: typeof Store; title: string; level: number; desc: string; cost: number | null; gold: number
  onUpgrade?: () => void; testId?: string; banner?: string; flash?: boolean
}) {
  const can = cost !== null && gold >= cost
  const [bannerOk, setBannerOk] = useState(true)
  const short = shortfallText(cost, gold)
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
        <button data-testid={testId} disabled={!can} onClick={onUpgrade}
          className={cn('text-[10px] rounded-md border px-2 py-1 transition-colors',
            can ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/50 cursor-not-allowed')}>
          {cost === null ? '已满级' : `升级 ${cost}G`}
        </button>
        {short && <p className="text-[10px] text-rose-400/80 text-center" data-testid={testId ? `${testId}-short` : undefined}>{short}</p>}
      </div>
    </div>
  )
}
