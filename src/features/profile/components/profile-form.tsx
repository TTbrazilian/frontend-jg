import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { UpdateProfileRequest, User } from '@/api/contracts'
import { announce } from '@/components/layout/live-region'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { applyApiFieldErrors } from '@/features/account/form-errors'
import { FormAlert } from '@/features/account/form-alert'
import { EnsInput, EnsLabel } from '@/features/account/ens-input'
import { emailField, lengthField, optionalEnsField, usernameField } from '@/features/account/validation'
import { useUpdateProfile } from '@/features/profile/hooks'
import { AvatarField } from './avatar-field'

const profileSchema = z.object({
  displayName: lengthField('O nome de exibição', 2, 40),
  username: usernameField,
  email: emailField,
  ensName: optionalEnsField,
  walletNickname: lengthField('O apelido da carteira', 2, 32),
})
type ProfileInput = z.input<typeof profileSchema>
type ProfileValues = z.output<typeof profileSchema>
const FIELDS = ['displayName', 'username', 'email', 'ensName', 'walletNickname'] as const

function toValues(user: User): ProfileInput {
  return {
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName ?? '',
    walletNickname: user.walletNickname,
  }
}

const inputCls = 'rounded-xs'

/** "Perfil do colecionador": dados persistidos via PATCH /me/profile (só campos alterados). */
export function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [formError, setFormError] = useState<string | null>(null)
  const values = useMemo(() => toValues(user), [user])
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, dirtyFields, isSubmitting },
  } = useForm<ProfileInput, unknown, ProfileValues>({
    resolver: zodResolver(profileSchema),
    // Atualiza com dados do servidor (refetch) sem apagar o que o usuário está editando.
    values,
    resetOptions: { keepDirtyValues: true },
    reValidateMode: 'onChange',
  })

  const onSubmit = async (parsed: ProfileValues) => {
    setFormError(null)
    const body: UpdateProfileRequest = {}
    for (const key of FIELDS) if (dirtyFields[key]) Object.assign(body, { [key]: parsed[key] })
    try {
      const saved = await update.mutateAsync(body)
      reset(toValues(saved))
      toast.success('Perfil atualizado.')
      announce('Perfil atualizado.')
    } catch (err) {
      const { apiError, applied, rest } = applyApiFieldErrors(err, setError, FIELDS)
      if (applied && rest.length === 0) return
      setFormError(rest[0] ?? apiError.message)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} data-testid="profile-form" aria-labelledby="profile-title" className="flex flex-col gap-8">
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <FormField id="profile-displayName" label="Nome de exibição" required error={errors.displayName?.message}>
          {(aria) => <Input {...aria} {...register('displayName')} autoComplete="name" data-testid="profile-displayName" className={inputCls} />}
        </FormField>
        <FormField id="profile-username" label="Nome de usuário" required error={errors.username?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('username')}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              data-testid="profile-username"
              className={inputCls}
            />
          )}
        </FormField>
        <FormField id="profile-email" label="E-mail" required error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              data-testid="profile-email"
              className={inputCls}
            />
          )}
        </FormField>
        <FormField
          id="profile-ensName"
          label={<EnsLabel />}
          error={errors.ensName?.message}
          hint="Opcional. 3 a 32 letras minúsculas, números ou hífen."
        >
          {(aria) => <EnsInput {...aria} {...register('ensName')} autoComplete="off" data-testid="profile-ensName" />}
        </FormField>
        <FormField id="profile-walletNickname" label="Apelido da carteira" required error={errors.walletNickname?.message}>
          {(aria) => <Input {...aria} {...register('walletNickname')} autoComplete="off" data-testid="profile-walletNickname" className={inputCls} />}
        </FormField>
        <AvatarField user={user} />
      </div>

      {formError ? <FormAlert data-testid="profile-error">{formError}</FormAlert> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!isDirty}
          data-testid="profile-save"
          className="h-10 min-w-[131px] rounded-xs"
        >
          Salvar
        </Button>
        {!isDirty ? <span className="text-caption text-sand">Nenhuma alteração para salvar.</span> : null}
      </div>
    </form>
  )
}
