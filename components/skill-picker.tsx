'use client'

import { MonstGirl, SkillKey } from '@/lib/types'
import { pickSkill, selectableSkills, pendingSkillPicks } from '@/lib/hub-logic'

const HINT: Record<SkillKey, string> = {
  口侍: '深喉、吞咽', 胸侍: '乳交；胸围越高越强', 身侍: '体位、内射、长时间', 手技: '抚摸、按摩、前戏',
  待客: '舞蹈、低语；加迎客', M性: '承受、求饶（与 S 性互斥）', S性: '主导、榨干（与 M 性互斥）',
}

export function SkillPicker({ girl, onPicked }: { girl: MonstGirl; onPicked: (g: MonstGirl) => void }) {
  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-3 space-y-2" data-testid="skill-picker">
      <p className="text-xs text-amber-300">{girl.name} 可以选择一个新技能（剩余 {pendingSkillPicks(girl)} 次）</p>
      <div className="grid grid-cols-2 gap-1.5">
        {selectableSkills(girl).map((s) => (
          <button key={s} className="rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-left hover:border-amber-400/60"
            onClick={() => { const g = pickSkill(girl, s); if (g) onPicked(g) }}>
            <p className="text-xs">{s}</p>
            <p className="text-[9px] text-muted-foreground">{HINT[s]}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
