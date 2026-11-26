import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountLayout, AccountPageTitle } from '@/features/account/account-layout'
import { FormAlert } from '@/features/account/form-alert'
import { PasswordForm } from '@/features/profile/components/password-form'
import { ProfileForm } from '@/features/profile/components/profile-form'
import { useProfile } from '@/features/profile/hooks'

/** /perfil — "Desktop / Perfil do Colecionador". */
export function ProfilePage() {
  const profile = useProfile()

  return (
    <AccountLayout>
      <div className="flex flex-col gap-8" data-testid="profile-page">
        <AccountPageTitle id="profile-title">Perfil do colecionador</AccountPageTitle>
        {profile.data ? (
          <>
            <ProfileForm user={profile.data} />
            <PasswordForm email={profile.data.email} />
          </>
        ) : profile.isError ? (
          <FormAlert
            data-testid="profile-load-error"
            action={
              <Button type="button" variant="outline" size="sm" loading={profile.isFetching} onClick={() => void profile.refetch()}>
                Tentar novamente
              </Button>
            }
          >
            Não foi possível carregar seu perfil. {toApiError(profile.error).message}
          </FormAlert>
        ) : (
          <ProfileSkeleton />
        )}
      </div>
    </AccountLayout>
  )
}

/** Mesma grade do formulário (3 linhas × 2 colunas + senha), para não deslocar o layout. */
function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Carregando perfil" className="flex flex-col gap-8">
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-[15px] w-40" />
            <Skeleton className="h-10 w-full rounded-xs" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-[131px] rounded-xs" />
      <div className="flex flex-col gap-6 md:w-[calc(50%-14px)]">
        <Skeleton className="h-4 w-36" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-[15px] w-32" />
            <Skeleton className="h-10 w-full rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  )
}
