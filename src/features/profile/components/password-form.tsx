import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { announce } from '@/components/layout/live-region'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { applyApiFieldErrors } from '@/features/account/form-errors'
import { FormAlert } from '@/features/account/form-alert'
import { isStrongPassword, PASSWORD_RULE } from '@/features/account/validation'
import { PasswordInput } from '@/features/auth/components/password-input'
import { useChangePassword } from '@/features/profile/hooks'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    newPassword: z.string().min(1, 'Crie uma nova senha.').refine(isStrongPassword, PASSWORD_RULE),
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })
  .refine((v) => !v.currentPassword || v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual.',
  })
type PasswordValues = z.infer<typeof passwordSchema>

const EMPTY: PasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' }
const API_FIELDS = ['currentPassword', 'newPassword'] as const

/**
 * "Alterar senha": formulário próprio (POST /me/password), independente do "Salvar" do perfil.
 * As senhas vivem só no estado do formulário — nada é persistido — e são limpas após o sucesso.
 */
export function PasswordForm({ email }: { email: string }) {
  const change = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: EMPTY,
    reValidateMode: 'onChange',
  })

  const onSubmit = async ({ currentPassword, newPassword }: PasswordValues) => {
    setFormError(null)
    try {
      await change.mutateAsync({ currentPassword, newPassword })
    } catch (err) {
      const { apiError, applied, rest } = applyApiFieldErrors(err, setError, API_FIELDS)
      if (applied && rest.length === 0) return
      setFormError(rest[0] ?? apiError.message ?? 'Não foi possível alterar a senha agora.')
      return
    }
    reset(EMPTY)
    const msg = 'Senha alterada. As outras sessões da sua conta foram encerradas.'
    toast.success(msg)
    announce(msg)
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      data-testid="password-form"
      aria-labelledby="password-title"
      aria-busy={isSubmitting || undefined}
      className="flex flex-col gap-6"
    >
      <h2 id="password-title" className="text-body-lg font-medium leading-4 text-foreground">
        Alterar senha
      </h2>
      {/* Ajuda gerenciadores de senha a associar a nova senha à conta (não é enviado). */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <FormField id="password-current" label="Senha atual" required error={errors.currentPassword?.message}>
            {(aria) => (
              <PasswordInput
                {...aria}
                {...register('currentPassword')}
                autoComplete="current-password"
                toggleLabel="Mostrar senha atual"
                data-testid="password-current"
                className="rounded-xs"
              />
            )}
          </FormField>
          <FormField
            id="password-new"
            label="Nova senha"
            required
            error={errors.newPassword?.message}
            hint="Mínimo de 8 caracteres, com letras e números."
          >
            {(aria) => (
              <PasswordInput
                {...aria}
                {...register('newPassword')}
                autoComplete="new-password"
                toggleLabel="Mostrar nova senha"
                data-testid="password-new"
                className="rounded-xs"
              />
            )}
          </FormField>
          <FormField id="password-confirm" label="Confirmar nova senha" required error={errors.confirmPassword?.message}>
            {(aria) => (
              <PasswordInput
                {...aria}
                {...register('confirmPassword')}
                autoComplete="new-password"
                toggleLabel="Mostrar confirmação da nova senha"
                data-testid="password-confirm"
                className="rounded-xs"
              />
            )}
          </FormField>
        </div>
      </div>

      {formError ? <FormAlert data-testid="password-error">{formError}</FormAlert> : null}

      <div>
        <Button type="submit" loading={isSubmitting} data-testid="password-submit" className="h-10 min-w-[131px] rounded-xs">
          {isSubmitting ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </div>
    </form>
  )
}
