import { useRef, type KeyboardEvent } from 'react'
import type { NftEdition } from '@/api/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export function editionStatusText(edition: NftEdition): string | null {
  if (edition.status === 'sold_out' || edition.available <= 0) return 'esgotada'
  if (edition.status === 'unavailable') return 'indisponível'
  return null
}

export const isEditionPurchasable = (e: NftEdition) => e.status === 'available' && e.available > 0

interface EditionChipsProps {
  editions: NftEdition[]
  value: string | null
  onChange: (editionId: string) => void
  labelledBy: string
  className?: string
}

/**
 * Chips de edição ("1/1", "1/10", "1/50", "ABERTA") como radiogroup acessível (setas navegam,
 * roving tabindex). Edições esgotadas/indisponíveis ficam desabilitadas e riscadas, com o motivo em texto.
 */
export function EditionChips({ editions, value, onChange, labelledBy, className }: EditionChipsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const enabled = editions.map(isEditionPurchasable)
  const focusIndex = Math.max(
    0,
    editions.findIndex((e) => e.id === value && isEditionPurchasable(e)),
  )

  const move = (from: number, dir: 1 | -1) => {
    for (let step = 1; step <= editions.length; step++) {
      const i = (from + dir * step + editions.length) % editions.length
      if (enabled[i]) {
        refs.current[i]?.focus()
        onChange(editions[i].id)
        return
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(index, 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(index, -1)
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={cn('flex flex-wrap items-center gap-1.5 md:gap-1.5', className)}>
      {editions.map((edition, index) => {
        const checked = edition.id === value
        const reason = editionStatusText(edition)
        const disabled = !enabled[index]
        return (
          <button
            key={edition.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            aria-label={`Edição ${edition.label}, ${formatEth(edition.priceEth)}${reason ? `, ${reason}` : `, ${edition.available} disponíveis`}`}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => (disabled ? undefined : onChange(edition.id))}
            onKeyDown={(e) => onKeyDown(e, index)}
            title={reason ? `Edição ${reason}` : undefined}
            data-testid={`edition-option-${edition.id}`}
            data-state={checked ? 'checked' : 'unchecked'}
            className={cn(
              'relative inline-flex h-7 min-w-9 items-center justify-center rounded-[50%] border px-2 text-body leading-4 transition-colors',
              'max-md:after:absolute max-md:after:-inset-y-1.5 max-md:after:inset-x-0 max-md:after:content-[""]',
              checked ? 'border-primary font-medium text-text-accent' : 'border-border text-text-secondary hover:border-primary/70',
              disabled && 'cursor-not-allowed text-sand/70 line-through decoration-1 hover:border-border',
            )}
          >
            {edition.label}
          </button>
        )
      })}
    </div>
  )
}
