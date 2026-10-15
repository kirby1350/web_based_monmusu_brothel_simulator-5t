'use client'

import { Home, ShoppingBag, Building2, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NavTab = 'hub' | 'market' | 'facilities' | 'flows'
const ITEMS: { key: NavTab; label: string; icon: typeof Home }[] = [
  { key: 'hub', label: '馆内', icon: Home },
  { key: 'market', label: '市场', icon: ShoppingBag },
  { key: 'facilities', label: '设施', icon: Building2 },
  { key: 'flows', label: '经营', icon: ListOrdered },
]

/** 底部导航（接客 / 调教向导里隐藏） */
export function BottomNav({ active, onChange, badges = {} }: { active: NavTab; onChange: (t: NavTab) => void; badges?: Partial<Record<NavTab, boolean>> }) {
  return (
    <nav className="shrink-0 border-t border-border bg-card/80 grid grid-cols-4" data-testid="bottom-nav">
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <button key={key} data-testid={`nav-${key}`} onClick={() => onChange(key)}
          className={cn('relative flex flex-col items-center gap-0.5 py-1.5 text-[10px] transition-colors',
            active === key ? 'text-amber-300' : 'text-muted-foreground hover:text-foreground')}>
          <Icon className="w-4 h-4" />
          {label}
          {badges[key] && <span className="absolute top-1 right-[30%] w-1.5 h-1.5 rounded-full bg-amber-400" />}
        </button>
      ))}
    </nav>
  )
}
