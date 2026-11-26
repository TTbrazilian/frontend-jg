import { toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountLayout } from '@/features/account/account-layout'
import { FormAlert } from '@/features/account/form-alert'
import { WalletSection } from '@/features/wallets/components/wallet-section'
import { WalletSummarySkeleton } from '@/features/wallets/components/wallet-summary'
import { useWallets } from '@/features/wallets/hooks'

/** /perfil/carteiras — "Desktop / Carteiras". */
export function WalletsPage() {
  const wallets = useWallets()
  const items = wallets.data?.items
  const primary = items?.find((w) => w.role === 'primary')
  const secondary = items?.find((w) => w.role === 'secondary')

  return (
    <AccountLayout>
      <div className="flex flex-col gap-8" data-testid="wallets-page">
        <h1 className="sr-only">Carteiras</h1>
        {items ? (
          <div className="flex flex-col gap-12">
            <WalletSection role="primary" wallet={primary} onStale={() => void wallets.refetch()} />
            <WalletSection role="secondary" wallet={secondary} primary={primary} onStale={() => void wallets.refetch()} />
          </div>
        ) : wallets.isError ? (
          <FormAlert
            data-testid="wallets-load-error"
            action={
              <Button type="button" variant="outline" size="sm" loading={wallets.isFetching} onClick={() => void wallets.refetch()}>
                Tentar novamente
              </Button>
            }
          >
            Não foi possível carregar suas carteiras. {toApiError(wallets.error).message}
          </FormAlert>
        ) : (
          <div role="status" aria-label="Carregando carteiras" className="flex flex-col gap-12">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-8">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-[15px] w-full max-w-[648px]" />
                </div>
                <WalletSummarySkeleton />
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  )
}
