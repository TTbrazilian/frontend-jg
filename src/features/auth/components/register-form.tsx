import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Session } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useRegister } from '@/features/auth/hooks'
import { applyApiFieldErrors, SR_ONLY_HINT } from '@/features/account/form-errors'
import { FormAlert } from '@/features/account/form-alert'
import { emailField, isStrongPassword, PASSWORD_RULE, usernameField } from '@/features/account/validation'
import { authFieldClasses, type AuthVariant } from './login-form'
import { PasswordInput } from './password-input'

const registerSchema = z
  .object({
    username: usernameField,
    email: emailField,
    password: z.string().min(1, 'Crie uma senha.').refine(isStrongPassword, PASSWORD_RULE),
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })
type RegisterInput = z.input<typeof registerSchema>
type RegisterValues = z.output<typeof registerSchema>

const API_FIELDS = ['username', 'email', 'password'] as const

interface RegisterFormProps {
  variant: AuthVariant
  submitLabel: string
  onSuccess: (session: Session) => void | Promise<void>
  className?: string
}

export function RegisterForm({ variant, submitLabel, onSuccess, className }: RegisterFormProps) {
  const registerUser = useRegister()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
    reValidateMode: 'onChange',
  })
  const cls = authFieldClasses(variant)

  const onSubmit = async ({ username, email, password }: RegisterValues) => {
    setFormError(null)
    let session: Session
    try {
      session = await registerUser.mutateAsync({ username, email, password })
    } catch (err) {
      // 409 CONFLICT (e-mail/usuário em uso) e 422 chegam com fieldErrors → no campo, com foco.
      const { apiError, applied, rest } = applyApiFieldErrors(err, setError, API_FIELDS)
      if (applied && rest.length === 0) return
      setFormError(rest[0] ?? apiError.message ?? 'Não foi possível criar a conta agora.')
      return
    }
    await onSuccess(session)
  }

  const submit = handleSubmit(onSubmit)

  return (
    <form noValidate onSubmit={submit} data-testid="register-form" aria-busy={isSubmitting || undefined} className={cn('flex flex-col', className)}>
      <div className="flex flex-col gap-3">
        <FormField
          id="register-username"
          label="Nome de usuário"
          srOnlyLabel
          required
          className={SR_ONLY_HINT}
          error={errors.username?.message}
          hint={<span className="sr-only">Letras minúsculas, números ou _, de 3 a 20 caracteres.</span>}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('username')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Nome de usuário"
              data-testid="register-username"
              className={cls.input}
            />
          )}
        </FormField>
        <FormField id="register-email" label="E-mail" srOnlyLabel required error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Digite seu e-mail"
              data-testid="register-email"
              className={cls.input}
            />
          )}
        </FormField>
        <FormField
          id="register-password"
          label="Senha"
          srOnlyLabel
          required
          className={SR_ONLY_HINT}
          error={errors.password?.message}
          hint={<span className="sr-only">{PASSWORD_RULE}</span>}
        >
          {(aria) => (
            <PasswordInput
              {...aria}
              {...register('password')}
              autoComplete="new-password"
              placeholder="Senha"
              data-testid="register-password"
              className={cls.input}
            />
          )}
        </FormField>
        <FormField id="register-confirm" label="Confirmar senha" srOnlyLabel required error={errors.confirmPassword?.message}>
          {(aria) => (
            <PasswordInput
              {...aria}
              {...register('confirmPassword')}
              autoComplete="new-password"
              placeholder="Confirmar senha"
              toggleLabel="Mostrar confirmação de senha"
              data-testid="register-confirm"
              className={cls.input}
            />
          )}
        </FormField>
      </div>

      {formError ? (
        <FormAlert
          className="mt-4"
          data-testid="register-error"
          action={
            <Button type="button" variant="link" className="text-body-sm" onClick={() => void submit()}>
              Tentar novamente
            </Button>
          }
        >
          {formError}
        </FormAlert>
      ) : null}

      <Button type="submit" loading={isSubmitting} data-testid="register-submit" className={cn('mt-6', cls.submit)}>
        {isSubmitting ? 'Criando…' : submitLabel}
      </Button>
    </form>
  )
}
