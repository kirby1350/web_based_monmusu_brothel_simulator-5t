'use client'

// 作弊面板（调试用）：深色、明确标「作弊」。只改存档，不调用 AI。
import { useState } from 'react'
import { nanoid } from 'nanoid'
import { X, Skull } from 'lucide-react'
import type { GameSave, GuestClass, SceneId, SensitivityZone, SkillKey, DesireKind, OutfitPref } from '@/lib/types'
import { GIRL_TEMPLATES, RACES, GUEST_PERSONALITIES } from '@/lib/game-data'
import { GUEST_CLASSES, GUEST_DESIRES, GUEST_PREF_TRAIT_TAGS } from '@/lib/game-engine'
import { COMMON_ZONES, OUTFIT_PREFS } from '@/lib/catalog'
import { PROF_SKILLS } from '@/lib/proficiency'
import { TRAINING_SCENES, shadowLevel } from '@/lib/scenes'
import {
  addGold, addReputation, unlockAll, addPresetGirl, restoreStamina, resetActions, endDayNow, skipToDay,
  setGirlStats, makeGuest, matchingGuestSpec, spawnGuest, setCheat, freeLimits, type GuestSpec, type GirlStatPatch,
} from '@/lib/cheat'

const box = 'rounded-lg border border-rose-900/60 bg-zinc-950/80 p-3 space-y-2'
const btn = 'h-7 px-2.5 rounded-md border border-rose-800/70 bg-rose-950/40 text-[11px] text-rose-200 hover:bg-rose-900/50 disabled:opacity-40'
const inp = 'h-7 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-100'
const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-[11px] font-semibold tracking-widest text-rose-400/90">{children}</h3>

export function CheatPanel({ save, onSaveChange, onClose }: { save: GameSave; onSaveChange: (s: GameSave) => void; onClose: () => void }) {
  const [msg, setMsg] = useState('')
  const apply = (s: GameSave, note: string) => { onSaveChange(s); setMsg(note) }
  const [day, setDay] = useState(save.currentDay + 1)
  const [girlId, setGirlId] = useState(save.girls[0]?.id ?? '')
  const girl = save.girls.find((g) => g.id === girlId)
  const [preset, setPreset] = useState('')
  const [spec, setSpec] = useState<GuestSpec>({})
  const presets = GIRL_TEMPLATES.map((t) => t.name).filter((n) => !save.girls.some((g) => g.name === n))

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-zinc-950 text-zinc-200" data-testid="cheat-panel">
      <div className="flex items-center justify-between border-b border-rose-900/70 bg-gradient-to-r from-rose-950/80 to-zinc-950 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Skull className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-bold text-rose-300">作弊面板</h2>
          <span className="rounded border border-rose-700 px-1.5 text-[10px] text-rose-400">作弊 · 调试用</span>
        </div>
        <button className="text-zinc-400 hover:text-zinc-100" onClick={onClose} data-testid="cheat-close"><X className="w-4 h-4" /></button>
      </div>
      {msg && <div className="px-4 py-1.5 text-[11px] text-emerald-300 border-b border-zinc-800" data-testid="cheat-msg">{msg}</div>}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <section className={box}>
          <H>金币 · 声望</H>
          <p className="text-[11px] text-zinc-400">现在 {save.player.gold}G · 声望 {save.player.reputation ?? 0}</p>
          <div className="flex flex-wrap gap-1.5">
            {[1000, 10000].map((n) => <button key={n} className={btn} data-testid={`cheat-gold-${n}`} onClick={() => apply(addGold(save, n), `金币 +${n}`)}>+{n}G</button>)}
            <button className={btn} data-testid="cheat-rep-10" onClick={() => apply(addReputation(save, 10), '声望 +10')}>声望 +10</button>
            <button className={btn} data-testid="cheat-rep-max" onClick={() => apply(addReputation(save, 100), '声望拉满')}>声望 100</button>
          </div>
        </section>

        <section className={box}>
          <H>解锁 · 日程 · 体力</H>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} data-testid="cheat-unlock" onClick={() => apply(unlockAll(save), '设施满级，场景/衣橱/道具全部到手')}>一键全解锁</button>
            <button className={btn} data-testid="cheat-stamina" onClick={() => apply(restoreStamina(save), '全员体力回满')}>全员体力回满</button>
            <button className={btn} data-testid="cheat-actions" onClick={() => apply(resetActions(save), '今天的行动次数已清零')}>行动次数清零</button>
            <button className={btn} data-testid="cheat-endday" onClick={() => apply(endDayNow(save), `已结束第 ${save.currentDay} 天`)}>立即结束今天</button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400">跳到第</span>
            <input type="number" min={1} className={`${inp} w-16`} value={day} onChange={(e) => setDay(Number(e.target.value))} data-testid="cheat-day" />
            <span className="text-[11px] text-zinc-400">天</span>
            <button className={btn} data-testid="cheat-skip" onClick={() => apply(skipToDay(save, day), `已跳到第 ${Math.max(1, Math.round(day))} 天（不跑夜间结算）`)}>跳转</button>
          </div>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={freeLimits(save)} data-testid="cheat-free" onChange={(e) => apply(setCheat(save, { freeLimits: e.target.checked }), e.target.checked ? '已解除每日限制' : '已恢复每日限制')} />
            解除每日限制（AI 润色客人不限当天一次、换客人免费不限次、送礼不限次）
          </label>
        </section>

        <section className={box}>
          <H>姑娘数值</H>
          <select className={`${inp} w-full`} value={girlId} onChange={(e) => setGirlId(e.target.value)} data-testid="cheat-girl">
            {save.girls.map((g) => <option key={g.id} value={g.id}>{g.name}（{g.race}）</option>)}
          </select>
          {girl && <GirlEditor key={girl.id} girl={girl} onApply={(p) => apply(setGirlStats(save, girl.id, p), `已改写${girl.name}的数值`)} />}
          {girl && <button className={btn} data-testid="cheat-match-guest" onClick={() => apply(spawnGuest(save, makeGuest(save, matchingGuestSpec(girl))), `已为${girl.name}加一位合适的客人`)}>为她造一位合适的客人</button>}
        </section>

        <section className={box}>
          <H>预设姑娘</H>
          <div className="flex gap-1.5">
            <select className={`${inp} flex-1`} value={preset} onChange={(e) => setPreset(e.target.value)} data-testid="cheat-preset">
              <option value="">选一位预设…</option>
              {presets.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className={btn} disabled={!preset} data-testid="cheat-preset-add" onClick={() => {
              const r = addPresetGirl(save, preset, nanoid())
              if ('error' in r) setMsg(r.error); else { apply(r, `${preset}已加入`); setPreset('') }
            }}>加入</button>
          </div>
        </section>

        <section className={box}>
          <H>造客人</H>
          <div className="grid grid-cols-2 gap-1.5">
            <Pick label="偏好种族" value={spec.race} opts={RACES.map((r) => r.name)} onChange={(race) => setSpec({ ...spec, race })} testid="cheat-g-race" />
            <Pick label="偏好身材" value={spec.trait} opts={GUEST_PREF_TRAIT_TAGS} onChange={(trait) => setSpec({ ...spec, trait })} testid="cheat-g-trait" />
            <Pick label="主类型" value={spec.main} opts={['口侍', '胸侍', '身侍']} onChange={(main) => setSpec({ ...spec, main: main as GuestSpec['main'] })} testid="cheat-g-main" />
            <Pick label="M/S" value={spec.kind} opts={['M', 'S', '中性']} onChange={(kind) => setSpec({ ...spec, kind: kind as DesireKind })} testid="cheat-g-kind" />
            <Pick label="身份" value={spec.guestClass} opts={Object.keys(GUEST_CLASSES)} labels={Object.values(GUEST_CLASSES).map((c) => c.label)} onChange={(c) => setSpec({ ...spec, guestClass: c as GuestClass })} testid="cheat-g-class" />
            <Pick label="性格" value={spec.personality} opts={GUEST_PERSONALITIES} onChange={(personality) => setSpec({ ...spec, personality })} testid="cheat-g-pers" />
            <Pick label="服装喜好" value={spec.prefOutfit ?? undefined} opts={OUTFIT_PREFS} onChange={(o) => setSpec({ ...spec, prefOutfit: (o as OutfitPref) ?? undefined })} testid="cheat-g-outfit" />
          </div>
          <Pick label="需求（含玩法；选了它就不看主类型/M-S）" value={spec.desires} opts={GUEST_DESIRES} onChange={(desires) => setSpec({ ...spec, desires })} testid="cheat-g-desire" />
          <button className={btn} data-testid="cheat-spawn" onClick={() => apply(spawnGuest(save, makeGuest(save, spec)), '新客人已排进今天的客人池最前面')}>造一位客人</button>
        </section>

        <section className={box}>
          <H>作弊模式</H>
          <button className={btn} data-testid="cheat-off" onClick={() => { onSaveChange(setCheat(save, { enabled: false })); onClose() }}>关闭作弊模式</button>
        </section>
      </div>
    </div>
  )
}

function Pick({ label, value, opts, labels, onChange, testid }: { label: string; value?: string; opts: readonly string[]; labels?: string[]; onChange: (v: string | undefined) => void; testid: string }) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-zinc-400">{label}
      <select className={inp} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} data-testid={testid}>
        <option value="">随机</option>
        {opts.map((o, i) => <option key={o} value={o}>{labels?.[i] ?? o}</option>)}
      </select>
    </label>
  )
}

function GirlEditor({ girl, onApply }: { girl: import('@/lib/types').MonstGirl; onApply: (p: GirlStatPatch) => void }) {
  const zones: SensitivityZone[] = [...COMMON_ZONES, '种族']
  const [p, setP] = useState<Required<Pick<GirlStatPatch, 'affection' | 'obedience' | 'lewdness' | 'stamina'>> & { sens: Record<string, number>; prof: Record<string, number>; fetishes: SceneId[]; shadows: Record<string, number> }>(() => ({
    affection: girl.affection, obedience: girl.obedience, lewdness: girl.lewdness, stamina: girl.stamina ?? 100,
    sens: Object.fromEntries(zones.map((z) => [z, girl.sensitivities?.[z] ?? 0])),
    prof: Object.fromEntries(PROF_SKILLS.map((s) => [s, girl.proficiency?.[s] ?? 0])),
    fetishes: [...(girl.awakened ?? [])],
    shadows: Object.fromEntries(TRAINING_SCENES.map((s) => [s.id, shadowLevel(girl, s.id)])),
  }))
  const num = (v: number, set: (n: number) => void, tid: string, max = 100) => (
    <input type="number" min={0} max={max} className={`${inp} w-14`} value={v} data-testid={tid} onChange={(e) => set(Number(e.target.value))} />
  )
  const row = (label: string, el: React.ReactNode) => <label className="flex items-center justify-between gap-1 text-[11px] text-zinc-300">{label}{el}</label>
  return (
    <div className="space-y-2" data-testid="cheat-girl-editor">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {row('好感', num(p.affection, (n) => setP({ ...p, affection: n }), 'cheat-aff'))}
        {row('服从', num(p.obedience, (n) => setP({ ...p, obedience: n }), 'cheat-obe'))}
        {row('淫乱', num(p.lewdness, (n) => setP({ ...p, lewdness: n }), 'cheat-lewd'))}
        {row('体力', num(p.stamina, (n) => setP({ ...p, stamina: n }), 'cheat-sta'))}
      </div>
      <p className="text-[10px] text-zinc-500">敏感带</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1">{zones.map((z) => <span key={z}>{row(z, num(p.sens[z], (n) => setP({ ...p, sens: { ...p.sens, [z]: n } }), `cheat-sens-${z}`))}</span>)}</div>
      <p className="text-[10px] text-zinc-500">熟练度（M性 / S性 决定 M-S 倾向）</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1">{PROF_SKILLS.map((s) => <span key={s}>{row(s, num(p.prof[s], (n) => setP({ ...p, prof: { ...p.prof, [s]: n } }), `cheat-prof-${s}`))}</span>)}</div>
      <p className="text-[10px] text-zinc-500">性癖（已觉醒） / 阴影档 0–3</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {TRAINING_SCENES.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-1 text-[11px]">
            <label className="flex items-center gap-1"><input type="checkbox" data-testid={`cheat-fetish-${s.id}`} checked={p.fetishes.includes(s.id)}
              onChange={(e) => setP({ ...p, fetishes: e.target.checked ? [...p.fetishes, s.id] : p.fetishes.filter((x) => x !== s.id) })} />{s.fetish}</label>
            <select className={`${inp} w-12`} value={p.shadows[s.id]} data-testid={`cheat-shadow-${s.id}`} onChange={(e) => setP({ ...p, shadows: { ...p.shadows, [s.id]: Number(e.target.value) } })}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ))}
      </div>
      <button className={btn} data-testid="cheat-girl-apply" onClick={() => onApply({
        affection: p.affection, obedience: p.obedience, lewdness: p.lewdness, stamina: p.stamina,
        sensitivities: p.sens as Partial<Record<SensitivityZone, number>>, proficiency: p.prof as Partial<Record<SkillKey, number>>,
        fetishes: p.fetishes, shadows: p.shadows,
      })}>写入数值</button>
    </div>
  )
}
