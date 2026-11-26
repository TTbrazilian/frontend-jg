import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Session } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'
import { useLogin } from '@/features/auth/hooks'
import { applyApiFieldErrors } from '@/features/account/form-errors'
import { FormAlert } from '@/features/account/form-alert'
import { emailField } from '@/features/account/validation'
import { PasswordInput } from './password-input'

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Informe sua senha.'),
})
type LoginInput = z.input<typeof loginSchema>
type LoginValues = z.output<typeof loginSchema>

export type AuthVariant = 'modal' | 'page' | 'inline'

/** Classes por variante: modal do Figma desktop (40px/5px) ou página mobile (50px/10px). */
export function authFieldClasses(variant: AuthVariant) {
  return variant === 'page'
    ? { input: 'h-[50px] rounded-[10px] px-4 text-body', submit: 'h-[60px] w-full rounded-[10px] text-body-lg' }
    : { input: 'h-10 rounded-md px-4 text-body', submit: 'h-[45px] w-full rounded-md text-body-lg' }
}

interface LoginFormProps {
  variant: AuthVariant
  /** Prefixo dos ids (evita colisão entre a página e o diálogo de sessão expirada). */
  idPrefix: string
  defaultEmail?: string
  submitLabel?: string
  submitTestId?: string
  /** Chamado após a sessão ser criada (o hook já trocou identidade e caches). */
  onSuccess: (session: Session) => void | Promise<void>
  className?: string
}

export function LoginForm({ variant, idPrefix, defaultEmail = '', submitLabel = 'Entrar', submitTestId = 'login-submit', onSuccess, className }: LoginFormProps) {
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = form
  const cls = authFieldClasses(variant)

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    let session: Session
    try {
      session = await login.mutateAsync(values)
    } catch (err) {
      const { apiError, applied } = applyApiFieldErrors(err, setError, ['email', 'password'])
      if (apiError.code === 'INVALID_CREDENTIALS') {
        setFormError('E-mail ou senha incorretos. Confira os dados e tente novamente.')
        setFocus('password')
        return
      }
      if (applied) return
      setFormError(apiError.message || 'Não foi possível entrar agora.')
      return
    }
    await onSuccess(session)
  }

  const submit = handleSubmit(onSubmit)
  const invalidCredentials = formError?.startsWith('E-mail ou senha')

  return (
    <form noValidate onSubmit={submit} data-testid="login-form" aria-busy={isSubmitting || undefined} className={cn('flex flex-col', className)}>
      <div className="flex flex-col gap-3">
        <FormField id={`${idPrefix}-email`} label="E-mail" srOnlyLabel required error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="contato@email.com"
              data-testid="login-email"
              className={cls.input}
            />
          )}
        </FormField>
        <FormField id={`${idPrefix}-password`} label="Senha" srOnlyLabel required error={errors.password?.message}>
          {(aria) => (
            <PasswordInput
              {...aria}
              {...register('password')}
              autoComplete="current-password"
              placeholder="Senha"
              data-testid="login-password"
              className={cls.input}
            />
          )}
        </FormField>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => comingSoon('Recuperação de senha')}
            className="min-h-10 rounded-sm text-body text-text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring md:min-h-0"
          >
            Esqueceu a senha?
          </button>
        </div>
      </div>

      {formError ? (
        <FormAlert
          className="mt-4"
          data-testid="login-error"
          action={
            invalidCredentials ? undefined : (
              <Button type="button" variant="link" className="text-body-sm" onClick={() => void submit()}>
                Tentar novamente
              </Button>
            )
          }
        >
          {formError}
        </FormAlert>
      ) : null}

      <Button type="submit" loading={isSubmitting} data-testid={submitTestId} className={cn('mt-6', cls.submit)}>
        {isSubmitting ? 'Entrando…' : submitLabel}
      </Button>
    </form>
  )
}
