import { StarIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

/** 5 estrelas do Figma (cheias em laranja, vazias em areia); o valor vai em texto para leitores de tela. */
export function StarRating({ value, className, size = 15 }: { value: number; className?: string; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="sr-only">Nota {value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de 5</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} width={size} height={size} className={i <= rounded ? 'text-primary' : 'text-text-secondary'} />
      ))}
    </span>
  )
}
