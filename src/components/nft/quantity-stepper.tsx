import { useEffect, useId, useState } from 'react'
import { MinusIcon, PlusIcon } from '@/components/layout/extra-icons'
import { cn } from '@/lib/utils'

export interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  /** Rótulo acessível do campo (ex.: "Quantidade de Emerald Ape #042"). */
  label?: string
  /** `lg` = 33×50 (detalhe desktop); `sm` = 20×30 (barra mobile/carrinho), com área de toque ampliada. */
  size?: 'lg' | 'sm'
  className?: string
}

/**
 * Seletor de quantidade do Figma: botões −/+ em pílula laranja e campo numérico (spinbutton nativo).
 * O valor é sempre limitado a [min, max]; digitação inválida volta ao último valor válido.
 */
export function QuantityStepper({ value, min = 1, max, onChange, disabled = false, label = 'Quantidade', size = 'lg', className }: QuantityStepperProps) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  const effectiveMax = Math.max(min, max)
  const off = disabled || max < min
  const clamp = (n: number) => Math.min(effectiveMax, Math.max(min, n))

  const commit = (raw: string) => {
    const n = Number.parseInt(raw, 10)
    if (Number.isNaN(n)) return setDraft(String(value))
    const next = clamp(n)
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  const btn = cn(
    'relative grid shrink-0 place-items-center rounded-pill border border-ink bg-primary text-ink shadow-card transition-colors',
    'hover:bg-brand-light active:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40',
    // área de toque ≥ 40px mesmo no tamanho pequeno
    'after:absolute after:-inset-2 after:content-[""]',
    size === 'lg' ? 'h-[50px] w-[33px]' : 'h-[30px] w-5',
  )
  const icon = size === 'lg' ? 16 : 10

  return (
    <div className={cn('flex items-center', size === 'lg' ? 'gap-3' : 'gap-3', className)} role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clamp(value - 1))}
        disabled={off || value <= min}
        aria-label="Diminuir quantidade"
        aria-controls={id}
        data-testid="quantity-decrement"
      >
        <MinusIcon width={icon} height={icon} />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={effectiveMax}
        step={1}
        value={draft}
        disabled={off}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value)
        }}
        className={cn(
          'min-w-[2ch] bg-transparent text-center text-foreground [field-sizing:content] focus-visible:rounded-xs disabled:opacity-60',
          size === 'lg' ? 'w-7 text-title' : 'w-6 text-title-sm font-medium',
        )}
        data-testid="quantity-value"
      />
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clamp(value + 1))}
        disabled={off || value >= effectiveMax}
        aria-label="Aumentar quantidade"
        aria-controls={id}
        data-testid="quantity-increment"
      >
        <PlusIcon width={icon} height={icon} />
      </button>
    </div>
  )
}
