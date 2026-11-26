import { useId } from 'react'
import { NETWORK_LABELS, type Nft } from '@/api/contracts'
import { CartIcon, HeartIcon, LinkedinIcon, MailIcon, StarIcon, TwitterIcon, WarningIcon } from '@/components/icons'
import { HeartFilledIcon, ShopFilledIcon } from '@/components/layout/extra-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatEth } from '@/lib/money'
import { cn, shortAddress } from '@/lib/utils'
import { EditionChips, editionStatusText } from './edition-chips'
import { QuantityStepper } from './quantity-stepper'
import { StarRating } from './star-rating'
import type { NftPurchase } from './use-nft-purchase'
import { useFavoriteToggle } from './use-favorite'

const ratingFmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const reviewsText = (n: number) => (n === 0 ? 'Sem avaliações ainda' : `${n} ${n === 1 ? 'avaliação' : 'avaliações'} de colecionadores`)

/** Estrelas + "19 avaliações de colecionadores" (desktop). */
export function RatingSummary({ nft, className }: { nft: Nft; className?: string }) {
  return (
    <p className={cn('flex items-center gap-1 text-body-md text-foreground', className)}>
      {nft.rating.count > 0 ? <StarRating value={nft.rating.average} /> : null}
      <span>{reviewsText(nft.rating.count)}</span>
    </p>
  )
}

/** Pílula "★ 4.8 (19)" do mobile. */
export function RatingPill({ nft }: { nft: Nft }) {
  if (nft.rating.count === 0) return <span className="shrink-0 text-body text-text-secondary">Sem avaliações</span>
  return (
    <p className="flex h-[27px] shrink-0 items-center gap-1 rounded-pill border border-primary px-2.5 text-body leading-4">
      <StarIcon width={14} height={14} className="text-primary" />
      <span className="sr-only">Nota </span>
      <span className="font-medium text-foreground">{ratingFmt(nft.rating.average)}</span>
      <span className="sr-only"> de 5, </span>
      <span className="text-text-secondary">
        ({nft.rating.count})<span className="sr-only"> avaliações</span>
      </span>
    </p>
  )
}

/** "Edição:" + chips (radiogroup) + motivo textual das edições bloqueadas. */
export function EditionPicker({ nft, purchase, className }: { nft: Nft; purchase: NftPurchase; className?: string }) {
  const labelId = useId()
  const blocked = nft.editions.map((e) => ({ e, reason: editionStatusText(e) })).filter((x) => x.reason)
  return (
    <div className={cn('flex flex-col gap-2 md:gap-3', className)}>
      <p id={labelId} className="text-body-md font-bold leading-4 text-foreground">
        Edição:
      </p>
      <EditionChips editions={nft.editions} value={purchase.edition?.id ?? null} onChange={purchase.selectEdition} labelledBy={labelId} className="gap-3 md:gap-1.5" />
      {blocked.length ? (
        <p className="text-caption text-sand">
          {blocked.map(({ e, reason }, i) => (
            <span key={e.id}>
              {i > 0 ? ' · ' : ''}
              {e.label} {reason}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}

/** Aviso quando a edição escolhida esgota/fica indisponível (inclusive ao vivo). */
export function EditionStatusNotice({ purchase, className }: { purchase: NftPurchase; className?: string }) {
  if (!purchase.edition || purchase.purchasable) return null
  return (
    <p role="status" className={cn('flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body text-foreground', className)} data-testid="edition-unavailable">
      <WarningIcon width={18} height={18} className="shrink-0 text-destructive" />
      {purchase.edition.status === 'unavailable'
        ? `A edição ${purchase.edition.label} está indisponível. Escolha outra edição.`
        : `A edição ${purchase.edition.label} está esgotada. Escolha outra edição.`}
    </p>
  )
}

/** Botão Favoritar (otimista; visitante vai ao login e volta). */
export function FavoriteButton({ nft, variant }: { nft: Nft; variant: 'desktop' | 'mobile' }) {
  const { isFavorite, onToggle } = useFavoriteToggle(nft.id, nft.title)
  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remover ${nft.title} dos favoritos` : `Favoritar ${nft.title}`}
        className="grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised text-text-accent transition-colors hover:border-primary"
        data-testid="favorite-toggle"
      >
        {isFavorite ? <HeartFilledIcon width={18} height={16} /> : <HeartIcon width={18} height={18} />}
      </button>
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onToggle}
      aria-pressed={isFavorite}
      className="h-10 w-[130px] gap-2 font-medium"
      data-testid="favorite-toggle"
    >
      {isFavorite ? <HeartFilledIcon width={18} height={16} /> : <HeartIcon width={20} height={20} />}
      {isFavorite ? 'Favoritado' : 'Favoritar'}
    </Button>
  )
}

/** Quantidade + COMPRAR / Adicionar ao carrinho / Favoritar (desktop). */
export function DesktopBuyActions({ nft, purchase }: { nft: Nft; purchase: NftPurchase }) {
  const hintId = useId()
  const off = !purchase.purchasable
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <QuantityStepper
          value={purchase.quantity}
          max={purchase.max}
          onChange={purchase.setQuantity}
          disabled={off}
          label={`Quantidade de ${nft.title}`}
        />
        <p id={hintId} className="text-caption text-text-secondary">
          {purchase.hint}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={purchase.buyNow}
          disabled={off || purchase.pending !== null}
          loading={purchase.pending === 'buy'}
          aria-describedby={hintId}
          className="h-10 w-[130px]"
          data-testid="buy-now"
        >
          COMPRAR
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={purchase.addToCart}
          disabled={off || purchase.pending !== null}
          loading={purchase.pending === 'add'}
          aria-label="Adicionar ao carrinho"
          title="Adicionar ao carrinho"
          data-testid="add-to-cart"
        >
          {purchase.pending === 'add' ? null : <CartIcon width={18} height={18} />}
        </Button>
        <FavoriteButton nft={nft} variant="desktop" />
      </div>
    </div>
  )
}

/** Barra de compra fixa do Figma mobile: Qtd. −1+ · total · "Comprar NFT" · carrinho. */
export function MobileBuyBar({ nft, purchase }: { nft: Nft; purchase: NftPurchase }) {
  const off = !purchase.purchasable
  return (
    <section
      aria-label="Comprar"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] rounded-t-[40px] bg-card px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 shadow-overlay"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-body-md font-medium leading-4 text-text-secondary">
            Qtd.
          </span>
          <QuantityStepper
            size="sm"
            value={purchase.quantity}
            max={purchase.max}
            onChange={purchase.setQuantity}
            disabled={off}
            label={`Quantidade de ${nft.title}`}
          />
        </div>
        <p className="text-right text-title font-bold leading-4 text-text-accent">
          <span className="sr-only">Total: </span>
          {formatEth(purchase.total)}
        </p>
      </div>
      <p className="mt-2 text-caption text-text-secondary" aria-live="polite">
        {purchase.hint}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={purchase.buyNow}
          disabled={off || purchase.pending !== null}
          aria-busy={purchase.pending === 'buy' || undefined}
          className="inline-flex h-[60px] flex-1 items-center justify-center gap-2 rounded-pill bg-linear-to-b from-primary to-primary/80 text-body-lg font-bold text-primary-foreground transition-opacity disabled:opacity-50 sm:max-w-[260px]"
          data-testid="buy-now"
        >
          {purchase.pending === 'buy' ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
          Comprar NFT
        </button>
        <button
          type="button"
          onClick={purchase.addToCart}
          disabled={off || purchase.pending !== null}
          aria-busy={purchase.pending === 'add' || undefined}
          aria-label="Adicionar ao carrinho"
          className="grid size-[60px] shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-text-accent transition-colors hover:border-primary disabled:opacity-50"
          data-testid="add-to-cart"
        >
          {purchase.pending === 'add' ? (
            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <ShopFilledIcon width={20} height={20} />
          )}
        </button>
      </div>
    </section>
  )
}

/** ID do token, coleção, atributos e "Compartilhar este NFT". */
export function NftMeta({ nft, className, share = true }: { nft: Nft; className?: string; share?: boolean }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/nft/${nft.id}` : `/nft/${nft.id}`
  const enc = encodeURIComponent
  const links = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, Icon: LinkedinIcon, external: true },
    { label: 'e-mail', href: `mailto:?subject=${enc(`${nft.title} na Kurio`)}&body=${enc(url)}`, Icon: MailIcon, external: false },
    { label: 'X (Twitter)', href: `https://twitter.com/intent/tweet?text=${enc(nft.title)}&url=${enc(url)}`, Icon: TwitterIcon, external: true },
  ]
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <dl className="flex flex-col gap-3 text-body-md text-sand">
        <div>
          <dt className="inline">ID do token: </dt>
          <dd className="inline">#{nft.tokenId}</dd>
        </div>
        <div>
          <dt className="inline">Coleção: </dt>
          <dd className="inline">{nft.collection.name}</dd>
        </div>
        {nft.attributes.length ? (
          <div>
            <dt className="inline">Atributos: </dt>
            <dd className="inline">{nft.attributes.join(', ')}</dd>
          </div>
        ) : null}
      </dl>
      {share ? (
        <div className="flex items-center gap-2">
          <p className="text-body-md font-bold leading-4 text-foreground">Compartilhar este NFT:</p>
          <ul className="flex items-center gap-1">
            {links.map(({ label, href, Icon, external }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="grid size-7 place-items-center rounded-sm text-foreground transition-colors hover:text-text-accent"
                  title={`Compartilhar por ${label}${external ? ' (abre em nova aba)' : ''}`}
                >
                  <Icon width={16} height={16} />
                  <span className="sr-only">
                    Compartilhar por {label}
                    {external ? ' (abre em nova aba)' : ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Abas "Detalhes do NFT" e "Avaliações de colecionadores (N)". */
export function NftDetailTabs({ nft, className }: { nft: Nft; className?: string }) {
  const paragraphs = nft.longDescription.split(/\n{2,}/).filter(Boolean)
  const network = NETWORK_LABELS[nft.network]
  // O total vem da nota agregada; a lista traz as avaliações mais recentes.
  const count = Math.max(nft.rating.count, nft.reviews.length)
  const trigger =
    '-mb-px shrink-0 border-b-[3px] pb-3 text-title-sm font-normal leading-4 md:text-[1.0625rem] data-[state=active]:font-bold'
  return (
    <Tabs defaultValue="details" className={cn('flex flex-col', className)}>
      <TabsList aria-label="Informações do NFT" className="w-full gap-6 border-b-[0.5px] border-primary/70 md:gap-8">
        <TabsTrigger value="details" className={trigger}>
          Detalhes do NFT
        </TabsTrigger>
        <TabsTrigger value="reviews" className={trigger}>
          <span className="md:hidden">Avaliações ({count})</span>
          <span className="max-md:hidden">Avaliações de colecionadores ({count})</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="mt-3 flex flex-col gap-3 text-body leading-6 text-text-secondary">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-bold text-foreground">Rede:</dt>
            <dd>Cunhado na {network} com procedência imutável e metadados armazenados no IPFS.</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Contrato:</dt>
            <dd>
              <span title={nft.contractAddress}>{shortAddress(nft.contractAddress)}</span> • Contrato inteligente {nft.tokenStandard} verificado.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Direitos autorais:</dt>
            <dd>
              Direitos autorais do criador: {nft.royaltiesPercent.toLocaleString('pt-BR')}% nas vendas secundárias, pagos automaticamente pelos
              mercados compatíveis.
            </dd>
          </div>
        </dl>
      </TabsContent>
      <TabsContent value="reviews" className="mt-4">
        {nft.reviews.length > 0 && nft.reviews.length < count ? (
          <p className="mb-3 text-caption text-sand">
            Exibindo as {nft.reviews.length} avaliações mais recentes de {count}.
          </p>
        ) : null}
        {nft.reviews.length === 0 ? (
          <p className="text-body text-text-secondary">Este NFT ainda não recebeu avaliações.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {nft.reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-body-md font-bold text-foreground">{r.author}</p>
                  <StarRating value={r.rating} size={13} />
                  <time dateTime={r.createdAt} className="text-caption text-sand">
                    {dateFmt.format(new Date(r.createdAt))}
                  </time>
                </div>
                <p className="text-body leading-6 text-text-secondary">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}

/** Skeleton do detalhe com as mesmas dimensões (sem salto ao carregar). */
export function NftDetailSkeleton({ variant }: { variant: 'desktop' | 'mobile' }) {
  if (variant === 'mobile') {
    return (
      <div data-testid="nft-detail-skeleton" aria-busy="true" className="flex flex-col">
        <span className="sr-only" role="status">
          Carregando NFT…
        </span>
        <div aria-hidden className="bg-linear-to-b from-card to-surface-raised px-7 pb-[84px] pt-6">
          <div className="flex justify-between">
            <Skeleton className="size-[35px] rounded-full" />
            <Skeleton className="size-[35px] rounded-full" />
          </div>
          <Skeleton className="mt-2 aspect-[361/356] w-full rounded-3xl" />
        </div>
        <div aria-hidden className="relative -mt-[114px] flex flex-col gap-4 rounded-t-[31px] bg-card px-6 pb-8 pt-8">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      </div>
    )
  }
  return (
    <div data-testid="nft-detail-skeleton" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Carregando NFT…
      </span>
      <Skeleton className="h-4 w-48" />
      <div aria-hidden className="grid gap-8 lg:grid-cols-[minmax(0,573fr)_minmax(0,595fr)]">
        <div className="flex items-center gap-4 lg:gap-7">
          <div className="flex w-[18%] max-w-[100px] shrink-0 flex-col gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full max-w-[444px] flex-1 rounded-md" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-56" />
          <Skeleton className="h-[50px] w-full" />
          <Skeleton className="h-24 w-72" />
        </div>
      </div>
    </div>
  )
}
