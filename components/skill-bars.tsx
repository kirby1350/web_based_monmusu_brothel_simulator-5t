'use client'

import type { MonstGirl, SkillKey } from '@/lib/types'
import { getInclination } from '@/lib/catalog'
import { SERVING_PROF_SKILLS, PROF_TIERS, proficiencyFromLegacy, profShow, profTierLabel, nextTier, SERVICE_PROF_CAP } from '@/lib/proficiency'
import { cn } from '@/lib/utils'

const TIER_COLOR: Record<string, string> = { 未学: 'text-muted-foreground', 初学: 'text-sky-300', 熟练: 'text-emerald-300', 精通: 'text-amber-300' }
const BAR_COLOR: Record<string, string> = { 未学: 'bg-slate-500/60', 初学: 'bg-sky-400/70', 熟练: 'bg-emerald-400/70', 精通: 'bg-amber-400/80' }
const TICKS = [PROF_TIERS.初学, PROF_TIERS.熟练, PROF_TIERS.精通]

function Bar({ k, v }: { k: SkillKey; v: number }) {
  const tier = profTierLabel(v)
  const nt = nextTier(v)
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-1.5" data-testid={`prof-${k}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs w-10 shrink-0">{k}</span>
        <div className="relative flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className={cn('h-full', BAR_COLOR[tier])} style={{ width: `${Math.min(100, v)}%` }} />
          {TICKS.map((t) => <span key={t} className="absolute top-0 h-full w-px bg-background/80" style={{ left: `${t}%` }} />)}
        </div>
        <span className={cn('text-[10px] w-14 text-right', TIER_COLOR[tier])}>{tier} {profShow(v)}</span>
      </div>
      {nt && <p className="text-[9px] text-muted-foreground/70 mt-0.5 pl-[52px]">再 {Math.ceil(nt.at - v)} 点 → {nt.rank}</p>}
    </div>
  )
}

/** 魔物娘卡「技能」tab：七条熟练度（照敏感带样式），25 / 50 / 75 刻度 */
export function SkillBars({ girl }: { girl: MonstGirl }) {
  const p = girl.proficiency ?? proficiencyFromLegacy(girl)
  const incl = getInclination(girl)
  return (
    <div className="space-y-3" data-testid="skill-bars">
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">服侍技能熟练度</p>
        {SERVING_PROF_SKILLS.map((k) => <Bar key={k} k={k} v={p[k] ?? 0} />)}
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">倾向 · <span className="text-fuchsia-300 normal-case" data-testid="incl">{incl}</span></p>
        <Bar k="M性" v={p['M性'] ?? 0} />
        <Bar k="S性" v={p['S性'] ?? 0} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        接客会慢慢练熟对应技能（最多到 {SERVICE_PROF_CAP}），精通要靠调教「特训」。驯服涨 M性、放权涨 S性；高的一侧 ≥25 决定倾向，两侧都 ≥50 且服从、淫乱都 ≥70 会成为「两面」。
      </p>
    </div>
  )
}
