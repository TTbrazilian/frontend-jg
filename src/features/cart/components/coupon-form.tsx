import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { AppliedCoupon } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { announce } from '@/components/layout/live-region'
import { useApplyCoupon, useRemoveCoupon } from '@/features/cart/hooks'
import { cn } from '@/lib/utils'

const FIELD_ERRORS = new Set(['COUPON_INVALID', 'COUPON_EXPIRED', 'VALIDATION_ERROR'])

interface CouponFormProps {
  coupon: AppliedCoupon | null
  /** Rótulo visível acima do campo ("Código promocional" no desktop). */
  showLabel?: boolean
  className?: string
  /** Foca o campo ao montar (quando aberto por "Aplique aqui"). */
  autoFocus?: boolean
}

/**
 * Código promocional: input + Aplicar; com cupom aplicado mostra código, descrição e "Remover".
 * Erros de cupom (inválido/expirado) aparecem no próprio campo, associados por aria-describedby.
 */
export function CouponForm({ coupon, showLabel = true, className, autoFocus }: CouponFormProps) {
  const id = useId()
  const inputId = `${id}-coupon`
  const errorId = `${id}-coupon-error`
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) {
      setError('Informe um código promocional.')
      return
    }
    setError(null)
    apply.mutate(value, {
      onSuccess: (cart) => {
        setCode('')
        const msg = `Cupom ${cart.coupon?.code ?? value.toUpperCase()} aplicado.`
        toast.success(msg)
        announce(msg)
      },
      onError: (err) => {
        const apiError = toApiError(err)
        if (FIELD_ERRORS.has(apiError.code)) {
          setError(apiError.fieldErrors.code ?? apiError.message)
          announce(apiError.fieldErrors.code ?? apiError.message, 'assertive')
        } else {
          toast.error(apiError.message)
        }
      },
    })
  }

  const onRemove = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Cupom removido.')
        announce('Cupom removido. Valores recalculados.')
      },
      onError: (err) => toast.error(toApiError(err).message),
    })
  }

  if (coupon) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {showLabel ? <p className="text-body font-bold">Código promocional</p> : null}
        <div className="flex items-center justify-between gap-3 rounded-xs border border-primary px-3 py-2 max-md:rounded-pill max-md:px-4">
          <div className="min-w-0">
            <p className="font-bold text-text-accent" data-testid="coupon-code">
              {coupon.code}
            </p>
            <p className="truncate text-caption text-text-secondary">{coupon.description}</p>
          </div>
          <Button type="button" variant="link" size="sm" onClick={onRemove} loading={remove.isPending} data-testid="coupon-remove">
            Remover<span className="sr-only"> cupom {coupon.code}</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className={cn('flex flex-col gap-2', className)} onSubmit={onSubmit} noValidate>
      <label htmlFor={inputId} className={cn('text-body font-bold', !showLabel && 'sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          'flex h-10 items-stretch overflow-hidden rounded-xs border border-primary has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/60',
          'max-md:h-[50px] max-md:rounded-pill max-md:border-border max-md:bg-card max-md:shadow-overlay',
          error && 'border-destructive max-md:border-destructive',
        )}
      >
        <input
          id={inputId}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-2 text-caption text-foreground placeholder:text-sand focus-visible:outline-none max-md:px-4 max-md:text-body-sm"
          data-testid="coupon-input"
        />
        <Button
          type="submit"
          loading={apply.isPending}
          className={cn(
            'h-auto w-[102px] shrink-0 rounded-none px-2 text-body-md',
            'max-md:w-[97px] max-md:rounded-pill max-md:bg-gradient-to-r max-md:from-primary/55 max-md:to-primary max-md:text-foreground',
          )}
          data-testid="coupon-apply"
        >
          Aplicar
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="text-caption font-medium text-destructive" data-testid="coupon-error">
          {error}
        </p>
      ) : null}
    </form>
  )
}
