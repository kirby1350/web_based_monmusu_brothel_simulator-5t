'use client'

import { X } from 'lucide-react'

/** 底部抽屉：盖在当前页面（相对定位的容器）上，点遮罩关闭 */
export function BottomSheet({ open, title, onClose, children, testId }: {
  open: boolean; title?: React.ReactNode; onClose: () => void; children: React.ReactNode; testId?: string
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 bg-black/60 flex items-end" onClick={onClose} data-testid={testId}>
      <div className="w-full max-h-[80%] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pt-3 pb-4 space-y-2.5 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div className="flex-1">{title && <p className="text-sm font-bold gold-text">{title}</p>}</div>
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="关闭"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
