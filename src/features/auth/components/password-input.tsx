import * as React from 'react'
import { EyeIcon } from 'lucide-react'
import { EyeOffIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Rótulo do botão de visibilidade (estado comunicado por aria-pressed). */
  toggleLabel?: string
  toggleClassName?: string
}

/**
 * Campo de senha com botão mostrar/ocultar (ícone "Hide" do Figma).
 * O botão é um toggle: rótulo fixo + aria-pressed.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, toggleLabel = 'Mostrar senha', toggleClassName, id, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)
    return (
      <div className="relative min-w-0">
        <Input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn('pr-12', className)}
          {...props}
        />
        <button
          type="button"
          aria-label={toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className={cn(
            'absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-sand transition-colors hover:text-text-accent',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
            toggleClassName,
          )}
        >
          {visible ? <EyeIcon aria-hidden width={20} height={20} strokeWidth={1.5} /> : <EyeOffIcon width={20} height={20} />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
