'use client'

import type { MonstGirl } from '@/lib/types'
import { PortraitImg } from '@/components/portrait-img'

/** 选人行 / 流程页用的小立绘（44×58），没图时显示种族首字 */
export function GirlThumb({ g }: { g: MonstGirl }) {
  return (
    <div className="w-11 h-[58px] shrink-0 rounded-md overflow-hidden border border-border bg-muted/40 flex items-center justify-center" data-testid={`thumb-${g.name}`}>
      {g.imageUrl
        ? <PortraitImg url={g.imageUrl} size="sm" sizes="44px" alt={g.name} className="w-full h-full object-cover object-top" />
        : <span className="text-sm text-muted-foreground">{g.race.slice(0, 1)}</span>}
    </div>
  )
}
