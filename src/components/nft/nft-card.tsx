import { memo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { ArrowRightIcon, CartIcon, HeartIcon } from '@/components/icons'
import { HeartFilledIcon } from '@/components/layout/extra-icons'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NftImage } from './nft-image'
import { Price } from './price'
import { useCartActions } from './use-cart-actions'
import { useFavoriteToggle } from './use-favorite'

export interface NftCardProps {
  nft: NftSummary
  /** `compact` = carrossel de relacionados (219px no Figma). */
  size?: 'default' | 'compact'
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** `sizes` da imagem (padrão: grade do catálogo). */
  imageSizes?: string
  className?: string
}

const actionBtn =
  'relative z-10 grid size-10 place-items-center rounded-full border border-border bg-surface-raised text-text-accent shadow-card transition-colors hover:border-primary hover:bg-surface-dark disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Card de NFT do Figma (imagem 250×250 em caixa 258×300 no desktop; 168 em caixa 175×200 com cantos
 * de 20px no mobile). O título é o link do card inteiro ("stretched link"); as ações (carrinho,
 * favoritar, ver detalhes) ficam acima dele, aparecem no hover/foco e sempre em telas de toque.
 */
export const NftCard = memo(function NftCard({ nft, size = 'default', headingLevel: Heading = 'h3', imageSizes, className }: NftCardProps) {
  const { quickAdd } = useCartActions()
  const [adding, setAdding] = useState(false)
  const { isFavorite, onToggle } = useFavoriteToggle(nft.id, nft.title)
  const compact = size === 'compact'

  const onAdd = async () => {
    setAdding(true)
    await quickAdd(nft.id, nft.title)
    setAdding(false)
  }

  return (
    <article
      className={cn('group relative flex h-full flex-col', className)}
      data-testid="nft-card"
      data-nft-id={nft.id}
      aria-busy={adding || undefined}
    >
      <div
        className={cn(
          'relative grid place-items-center overflow-hidden',
          'aspect-[175/200] rounded-2xl bg-linear-to-b from-card to-surface-raised md:aspect-[258/300] md:rounded-none md:bg-card md:bg-none',
          compact && 'md:aspect-[219/255]',
        )}
      >
        <NftImage
          image={nft.image}
          sizes={imageSizes ?? (compact ? '(min-width: 1024px) 212px, (min-width: 768px) 30vw, 45vw' : '(min-width: 1024px) 250px, (min-width: 768px) 45vw, 45vw')}
          decorative
          className={cn(
            'aspect-square w-[calc(100%-7px)] rounded-xl transition-transform duration-300 group-hover:scale-[1.02] md:w-[calc(100%-8px)]',
            compact && 'md:w-[calc(100%-7px)] md:rounded-[13px]',
          )}
        />
        <div className="pointer-events-none absolute left-0 top-4 flex flex-col items-start gap-1 md:top-6">
          {nft.badge === 'rare' ? (
            <Badge className="rounded-none px-2 py-2 text-body-sm font-medium leading-4 md:px-2 md:py-1">RARO</Badge>
          ) : null}
          {nft.soldOut ? (
            <Badge variant="muted" className="rounded-none border border-border-soft px-2 py-1 text-caption">
              Esgotado
            </Badge>
          ) : null}
        </div>

        {/* Ações: no mobile só o coração (canto, sempre visível, como no Figma); no desktop, barra no hover/foco. */}
        <div
          className={cn(
            'absolute right-3 top-3 z-10 flex items-center gap-2 md:inset-x-0 md:bottom-5 md:right-auto md:top-auto md:justify-center',
            'md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:[@media(hover:none)]:opacity-100',
          )}
        >
          {nft.soldOut ? (
            <button
              type="button"
              disabled
              className="relative z-10 hidden h-10 items-center rounded-pill border border-border bg-surface-raised px-4 text-body font-bold text-text-secondary md:inline-flex"
              data-testid="card-add-to-cart"
            >
              Esgotado
            </button>
          ) : (
            <button
              type="button"
              className={cn(actionBtn, 'hidden md:grid')}
              onClick={onAdd}
              disabled={adding}
              aria-label={`Adicionar ${nft.title} ao carrinho`}
              title="Adicionar ao carrinho"
              data-testid="card-add-to-cart"
            >
              {adding ? (
                <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <CartIcon width={18} height={18} />
              )}
            </button>
          )}
          <button
            type="button"
            className={cn(
              actionBtn,
              'max-md:size-7 max-md:after:absolute max-md:after:-inset-2.5 max-md:after:content-[""]',
            )}
            onClick={onToggle}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remover ${nft.title} dos favoritos` : `Favoritar ${nft.title}`}
            title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            data-testid="card-favorite-toggle"
          >
            {isFavorite ? <HeartFilledIcon width={16} height={14} /> : <HeartIcon width={16} height={16} />}
          </button>
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className={cn(actionBtn, 'hidden md:grid')}
            aria-label={`Ver detalhes de ${nft.title}`}
            title="Ver detalhes"
            tabIndex={-1}
          >
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </div>

      <div className={cn('flex flex-col pl-2 pt-2 md:pl-0', compact ? 'md:pt-3' : 'gap-1.5 md:pt-3')}>
        <Heading className={cn('leading-5 text-foreground', compact ? 'text-body-md' : 'text-body-md md:text-body-lg md:leading-4')}>
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="line-clamp-1 outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-text-accent focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring md:after:rounded-none"
          >
            {nft.title}
          </Link>
        </Heading>
        <Price
          value={nft.minPriceEth}
          compareAt={nft.compareAtPriceEth}
          valueClassName={compact ? 'text-body-lg' : 'text-body-lg md:text-title-sm'}
          compareClassName={compact ? 'text-body-lg' : 'text-body-lg md:text-title-sm'}
        />
      </div>
    </article>
  )
})

/** Skeleton com as mesmas proporções do card (sem salto de layout ao carregar). */
export function NftCardSkeleton({ size = 'default' }: { size?: 'default' | 'compact' }) {
  return (
    <div className="flex flex-col" data-testid="nft-card-skeleton" aria-hidden>
      <Skeleton className={cn('aspect-[175/200] rounded-2xl md:aspect-[258/300] md:rounded-none', size === 'compact' && 'md:aspect-[219/255]')} />
      <div className="flex flex-col gap-1.5 pl-2 pt-2 md:pl-0 md:pt-3">
        <Skeleton className="h-5 w-3/4 md:h-4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
