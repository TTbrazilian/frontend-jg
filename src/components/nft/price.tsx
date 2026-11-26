import type { EthAmount } from '@/api/contracts'
import { compareEth, formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

interface PriceProps {
  value: EthAmount
  compareAt?: EthAmount | null
  className?: string
  /** Classes do valor atual (tamanho/peso). */
  valueClassName?: string
  compareClassName?: string
}

/** Preço em laranja + preço "de" riscado (promoção), anunciado de forma explícita para leitores de tela. */
export function Price({ value, compareAt, className, valueClassName, compareClassName }: PriceProps) {
  const showCompare = !!compareAt && compareEth(compareAt, value) > 0
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-4', className)}>
      <span className={cn('text-title-sm font-bold text-text-accent', valueClassName)}>
        {showCompare ? <span className="sr-only">Preço atual: </span> : null}
        {formatEth(value)}
      </span>
      {showCompare ? (
        <s className={cn('text-title-sm font-normal text-sand', compareClassName)}>
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)}
        </s>
      ) : null}
    </p>
  )
}
