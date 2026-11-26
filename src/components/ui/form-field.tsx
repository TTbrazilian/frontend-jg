import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FormFieldProps {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string
  hint?: React.ReactNode
  className?: string
  /** Esconde o rótulo visualmente (mantém para leitores de tela). */
  srOnlyLabel?: boolean
  children: (aria: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => React.ReactNode
}

/**
 * Campo de formulário acessível: label associado, erro com aria-describedby
 * e aria-invalid, e dica opcional.
 */
export function FormField({ id, label, required, error, hint, className, srOnlyLabel, children }: FormFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} required={required} className={srOnlyLabel ? 'sr-only' : undefined}>
        {label}
        {required ? <span className="sr-only"> (obrigatório)</span> : null}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
