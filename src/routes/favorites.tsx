import { Link } from '@tanstack/react-router'
import { toApiError } from '@/api/errors'
import { HeartOutlineSmallIcon } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button, buttonVariants } from '@/components/ui/button'
import { AccountLayout, AccountPageTitle } from '@/features/account/account-layout'
import { FormAlert } from '@/features/account/form-alert'
import { useFavorites } from '@/features/favorites/hooks'
import { cn } from '@/lib/utils'

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-12 xl:gap-x-8'

/** /perfil/favoritos — "Lista de interesse" (sem frame no Figma: padrão do perfil + cards do catálogo). */
export function FavoritesPage() {
  const favorites = useFavorites()
  const items = favorites.data?.items

  return (
    <AccountLayout>
      <div className="flex flex-col gap-8" data-testid="favorites-page">
        <div className="flex flex-col gap-2">
          <AccountPageTitle>Lista de interesse</AccountPageTitle>
          {items && items.length > 0 ? (
            <p className="text-body leading-[15px] text-text-secondary" aria-live="polite">
              {items.length === 1 ? '1 NFT salvo' : `${items.length} NFTs salvos`}
            </p>
          ) : null}
        </div>

        {items ? (
          items.length > 0 ? (
            <ul className={GRID} data-testid="favorites-grid" aria-label="NFTs da lista de interesse">
              {items.map((nft) => (
                <li key={nft.id} className="min-w-0">
                  <NftCard nft={nft} headingLevel="h2" imageSizes="(min-width: 1024px) 270px, (min-width: 768px) 30vw, 45vw" />
                </li>
              ))}
            </ul>
          ) : (
            <div data-testid="favorites-empty" className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6 md:p-8">
              <span className="grid size-12 place-items-center rounded-full border border-border bg-surface-raised text-text-accent">
                <HeartOutlineSmallIcon aria-hidden width={22} height={22} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-body-lg font-bold text-foreground">Sua lista de interesse está vazia</h2>
                <p className="max-w-prose text-body text-text-secondary">
                  Toque no coração de um NFT para salvá-lo aqui e acompanhar preço e disponibilidade.
                </p>
              </div>
              <Link to="/mercado" className={cn(buttonVariants(), 'h-10 rounded-xs')}>
                Explorar o mercado
              </Link>
            </div>
          )
        ) : favorites.isError ? (
          <FormAlert
            data-testid="favorites-error"
            action={
              <Button type="button" variant="outline" size="sm" loading={favorites.isFetching} onClick={() => void favorites.refetch()}>
                Tentar novamente
              </Button>
            }
          >
            Não foi possível carregar sua lista de interesse. {toApiError(favorites.error).message}
          </FormAlert>
        ) : (
          <div role="status" aria-label="Carregando lista de interesse" className={GRID}>
            {Array.from({ length: 6 }, (_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  )
}
