import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * "Nome ENS" do Figma: caixa ".eth" à esquerda + campo do rótulo.
 * O sufixo é fixo (contrato: sempre ".eth"), então a caixa é informativa — sem a seta
 * de dropdown do Figma, para não parecer um seletor que não existe.
 */
export const EnsInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <div className="flex min-w-0 gap-2.5">
    <span
      aria-hidden
      className="flex h-10 w-[78px] shrink-0 items-center rounded-xs border border-border px-2.5 text-body-md text-foreground"
    >
      .eth
    </span>
    <Input
      ref={ref}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={cn('rounded-xs', className)}
      {...props}
    />
  </div>
))
EnsInput.displayName = 'EnsInput'

/** Texto do rótulo com a explicação do sufixo para leitores de tela. */
export function EnsLabel() {
  return (
    <>
      Nome ENS<span className="sr-only"> (sem o sufixo .eth)</span>
    </>
  )
}
