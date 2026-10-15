'use client'

import { useState } from 'react'
import type { MonstGirl } from '@/lib/types'
import type { PartnerOption } from '@/lib/starting-roster'
import { PortraitImg } from '@/components/portrait-img'
import { StatBar } from '@/components/stat-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { topSkillsText } from '@/lib/proficiency'
import { RACE_TRAITS } from '@/lib/catalog'
import { cn } from '@/lib/utils'

/** 开局第二人：从 3 位随机预设里挑 1 位 */
export function PartnerPick({ first, options, onDone }: { first: MonstGirl; options: PartnerOption[]; onDone: (partner: MonstGirl) => void }) {
  const [sel, setSel] = useState<number | null>(null)
  const chosen = options.find((o) => o.idx === sel)
  return (
    <div className="space-y-3" data-testid="partner-pick">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {first.name}已经住进馆里。再从下面三位里挑一位作伴——开局两个人，一个接客、一个调教，或者轮流休养。
      </p>
      {options.map(({ idx, girl }) => (
        <button key={idx} data-testid={`partner-${girl.name}`} onClick={() => setSel(idx)}
          className={cn('w-full text-left rounded-xl border bg-card p-2.5 flex gap-3 transition-colors select-none [&_*]:pointer-events-none',
            sel === idx ? 'border-amber-400/70 bg-amber-400/5' : 'border-border hover:border-primary/50')}>
          <div className="w-[72px] h-24 shrink-0 rounded-lg overflow-hidden border border-border bg-muted/30">
            {girl.imageUrl && <PortraitImg url={girl.imageUrl} size="sm" sizes="72px" alt={girl.name} className="w-full h-full object-cover object-top" />}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold gold-text">{girl.name}</span>
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{girl.race}</Badge>
              {RACE_TRAITS[girl.race] && <span className="text-[9px] text-amber-300/80">{RACE_TRAITS[girl.race]}</span>}
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-1">{girl.personality}</p>
            <div className="space-y-0.5">
              <StatBar label="好感" value={girl.affection} color="pink" size="sm" />
              <StatBar label="服从" value={girl.obedience} color="blue" size="sm" />
              <StatBar label="淫乱" value={girl.lewdness} color="rose" size="sm" />
            </div>
            <p className="text-[10px] text-sky-300/90">拿手：{topSkillsText(girl)}</p>
          </div>
        </button>
      ))}
      <Button className="w-full h-10" disabled={!chosen} onClick={() => chosen && onDone(chosen.girl)} data-testid="partner-confirm">
        {chosen ? `带上${chosen.girl.name}，开始经营` : '选一位'}
      </Button>
    </div>
  )
}
