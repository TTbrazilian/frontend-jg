import { useEffect, useId, useState, type FormEvent } from 'react'
import Big from 'big.js'
import type { EthAmount } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { compareEth, formatEth, isValidEthInput } from '@/lib/money'
import { cn } from '@/lib/utils'

const STEPS = 100

interface PriceRangeProps {
  /** Faixa do catálogo inteiro (limites do slider). */
  bounds: { minEth: EthAmount; maxEth: EthAmount } | undefined
  /** Valores aplicados (URL). */
  min: string | undefined
  max: string | undefined
  onApply: (range: { minPrice: string | undefined; maxPrice: string | undefined }) => void
  className?: string
}

/** Casas decimais do slider conforme a amplitude da faixa (sem passar por Number). */
function decimalsFor(span: Big): number {
  if (span.gte(10)) return 2
  if (span.gte(1)) return 3
  return 4
}

function trimZeros(fixed: string): string {
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
}

/** Posição (0..100) de um valor dentro da faixa. Usada só para desenhar o slider. */
function toPosition(value: string, lo: Big, span: Big): number {
  if (!isValidEthInput(value) || span.lte(0)) return 0
  const pos = new Big(value).minus(lo).div(span).times(STEPS).round(0, Big.roundHalfUp)
  return Math.min(STEPS, Math.max(0, pos.toNumber()))
}

/** Valor ETH (string) de uma posição do slider. */
function fromPosition(pos: number, lo: Big, hi: Big, span: Big): string {
  if (pos <= 0) return lo.toFixed()
  if (pos >= STEPS) return hi.toFixed()
  return trimZeros(lo.plus(span.times(pos).div(STEPS)).toFixed(decimalsFor(span), Big.roundHalfEven))
}

const thumb =
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-[21px] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-primary ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[15px] [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-primary'

/**
 * "Faixa de preço" do Figma: slider de duas pontas (dois `input[type=range]` nativos — setas,
 * Home/End e PageUp/PageDown funcionam) espelhado em dois campos de texto. Nada é aplicado até
 * "Aplicar"; os valores vão para a URL como string decimal (sem perda de precisão).
 */
export function PriceRange({ bounds, min, max, onApply, className }: PriceRangeProps) {
  const id = useId()
  const [minDraft, setMinDraft] = useState(min ?? '')
  const [maxDraft, setMaxDraft] = useState(max ?? '')
  const [error, setError] = useState<string | null>(null)

  // Voltar/avançar no histórico ou "Limpar filtros" atualizam os campos.
  useEffect(() => {
    setMinDraft(min ?? '')
    setMaxDraft(max ?? '')
    setError(null)
  }, [min, max])

  const lo = new Big(bounds?.minEth ?? '0')
  const hi = new Big(bounds?.maxEth ?? '0')
  const span = hi.minus(lo)
  const ready = !!bounds && span.gt(0)

  const minPos = minDraft ? toPosition(minDraft, lo, span) : 0
  const maxPos = maxDraft ? toPosition(maxDraft, lo, span) : STEPS

  const validate = (): string | null => {
    if (minDraft && !isValidEthInput(minDraft)) return 'Preço mínimo inválido. Use apenas números, ex.: 0.5'
    if (maxDraft && !isValidEthInput(maxDraft)) return 'Preço máximo inválido. Use apenas números, ex.: 2.75'
    if (minDraft && maxDraft && compareEth(minDraft.trim(), maxDraft.trim()) > 0) return 'O preço mínimo não pode ser maior que o máximo.'
    return null
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const err = validate()
    setError(err)
    if (err) return
    onApply({ minPrice: minDraft.trim() || undefined, maxPrice: maxDraft.trim() || undefined })
  }

  const errorId = `${id}-error`
  const shownMin = minDraft && isValidEthInput(minDraft) ? minDraft : bounds?.minEth
  const shownMax = maxDraft && isValidEthInput(maxDraft) ? maxDraft : bounds?.maxEth

  return (
    <form onSubmit={onSubmit} noValidate className={cn('flex flex-col gap-3 pl-3', className)} aria-describedby={error ? errorId : undefined}>
      {/* Slider de duas pontas */}
      <div className={cn('relative h-[21px]', !ready && 'opacity-50')}>
        <div aria-hidden className="absolute inset-x-[10px] top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary/30" />
        <div
          aria-hidden
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `calc(10px + (100% - 20px) * ${minPos / STEPS})`, right: `calc(10px + (100% - 20px) * ${1 - maxPos / STEPS})` }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={minPos}
          disabled={!ready}
          aria-label="Preço mínimo"
          aria-valuetext={shownMin ? formatEth(shownMin) : undefined}
          onChange={(e) => {
            const pos = Math.min(Number(e.target.value), maxPos)
            setMinDraft(pos <= 0 ? '' : fromPosition(pos, lo, hi, span))
            setError(null)
          }}
          className={cn('pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent', thumb, minPos >= STEPS - 2 && 'z-10')}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={maxPos}
          disabled={!ready}
          aria-label="Preço máximo"
          aria-valuetext={shownMax ? formatEth(shownMax) : undefined}
          onChange={(e) => {
            const pos = Math.max(Number(e.target.value), minPos)
            setMaxDraft(pos >= STEPS ? '' : fromPosition(pos, lo, hi, span))
            setError(null)
          }}
          className={cn('pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent', thumb)}
        />
      </div>

      {/* "Preço: 0,02 - 12,30 ETH" — editável */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-md text-foreground">
        <span aria-hidden>Preço:</span>
        <label htmlFor={`${id}-min`} className="sr-only">
          Preço mínimo em ETH
        </label>
        <input
          id={`${id}-min`}
          inputMode="decimal"
          autoComplete="off"
          value={minDraft}
          placeholder={bounds ? trimZeros(new Big(bounds.minEth).toFixed(2)) : '0'}
          onChange={(e) => {
            setMinDraft(e.target.value.replace(',', '.'))
            setError(null)
          }}
          aria-invalid={error?.includes('mínimo') || undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-8 w-[4.25rem] rounded-sm border border-border bg-background px-2 text-body text-foreground placeholder:text-sand/80 focus-visible:border-primary focus-visible:outline-none aria-invalid:border-destructive"
          data-testid="price-min"
        />
        <span aria-hidden>-</span>
        <label htmlFor={`${id}-max`} className="sr-only">
          Preço máximo em ETH
        </label>
        <input
          id={`${id}-max`}
          inputMode="decimal"
          autoComplete="off"
          value={maxDraft}
          placeholder={bounds ? trimZeros(new Big(bounds.maxEth).toFixed(2)) : '∞'}
          onChange={(e) => {
            setMaxDraft(e.target.value.replace(',', '.'))
            setError(null)
          }}
          aria-invalid={error?.includes('máximo') || undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-8 w-[4.25rem] rounded-sm border border-border bg-background px-2 text-body text-foreground placeholder:text-sand/80 focus-visible:border-primary focus-visible:outline-none aria-invalid:border-destructive"
          data-testid="price-max"
        />
        <span aria-hidden>ETH</span>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="sm" className="h-9 w-fit rounded-md px-3 text-body-lg" data-testid="price-apply">
        Aplicar
      </Button>
    </form>
  )
}
