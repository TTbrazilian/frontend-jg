import type { ReactNode } from 'react'
import { WarningIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

/** Mensagem de erro do formulário inteiro (anunciada por leitor de tela). */
export function FormAlert({ children, action, className, ...rest }: { children: ReactNode; action?: ReactNode; className?: string; 'data-testid'?: string }) {
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-destructive', className)}
      {...rest}
    >
      <WarningIcon width={16} height={16} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span>{children}</span>
        {action}
      </div>
    </div>
  )
}
