import * as React from 'react'
import { ChevronDownIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

/**
 * Select nativo com o visual do Figma (caixa 40px, placeholder areia, seta "Arrow-Down").
 * Nativo de propósito: teclado, leitor de tela e seletor do sistema no mobile sem custo extra.
 * O placeholder é a opção vazia; `required` liga o estilo `:invalid` enquanto nada foi escolhido.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder: string; options: ReadonlyArray<{ value: string; label: string }> }
>(({ className, placeholder, options, ...props }, ref) => (
  <div className="relative min-w-0">
    <select
      ref={ref}
      required
      className={cn(
        'h-10 w-full min-w-0 appearance-none truncate rounded-xs border border-border bg-transparent pl-3 pr-10 text-body text-foreground',
        'transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'invalid:text-sand aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
        '[&>option]:bg-card [&>option]:text-foreground',
        className,
      )}
      {...props}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDownIcon aria-hidden width={20} height={20} className="pointer-events-none absolute right-2.5 top-2.5 text-foreground" />
  </div>
))
NativeSelect.displayName = 'NativeSelect'
