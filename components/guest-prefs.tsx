'use client'

import type { Guest, MonstGirl, OutfitId } from '@/lib/types'
import { guestPrefChecks } from '@/lib/guest-prefs'
import { cn } from '@/lib/utils'

/** 客人喜好小标签：✓ 对得上（绿）/ ✗ 对不上（红）/ 无标记（中性） */
export function GuestPrefs({ guest, girls, outfit, stockings, wardrobe, compact, className }: {
  guest: Guest; girls: MonstGirl[]; outfit?: OutfitId; stockings?: string; wardrobe?: string[]; compact?: boolean; className?: string
}) {
  const checks = guestPrefChecks(guest, girls, { outfit, stockings, wardrobe })
  return (
    <div className={cn('flex flex-wrap gap-1', className)} data-testid="guest-prefs">
      {checks.filter((c) => !compact || c.key !== 'plays').map((c) => (
        <span key={c.key} data-testid={`pref-${c.key}`}
          className={cn('rounded px-1 leading-4 border', compact ? 'text-[9px]' : 'text-[10px]',
            c.ok === true ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/5'
              : c.ok === false ? 'border-rose-400/30 text-rose-300/90 bg-rose-400/5'
                : 'border-border text-muted-foreground')}>
          {c.ok === true ? '✓ ' : c.ok === false ? '✗ ' : ''}{c.label}
        </span>
      ))}
    </div>
  )
}
