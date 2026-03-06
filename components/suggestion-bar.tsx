'use client'

import { Button } from '@/components/ui/button'

interface SuggestionBarProps {
  suggestions: [string, string, string] | null
  onSelect: (text: string) => void
  disabled?: boolean
}

export function SuggestionBar({ suggestions, onSelect, disabled = false }: SuggestionBarProps) {
  if (!suggestions) return null

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 text-xs border-primary/30 text-primary/80 hover:bg-primary/10 hover:text-primary hover:border-primary/60"
          onClick={() => onSelect(s)}
        >
          {s}
        </Button>
      ))}
    </div>
  )
}
