import { useEffect } from 'react'
import { getRouteApi, Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import type { Nft } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { ArrowLeftIcon, WarningIcon } from '@/components/icons'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Container } from '@/components/layout/container'
import { useIsDesktop } from '@/components/layout/use-media-query'
import { NftGallery, NftGalleryMobile } from '@/components/nft/nft-gallery'
import {
  DesktopBuyActions,
  EditionPicker,
  EditionStatusNotice,
  FavoriteButton,
  MobileBuyBar,
  NftDetailSkeleton,
  NftDetailTabs,
  NftMeta,
  RatingPill,
  RatingSummary,
} from '@/components/nft/nft-detail-parts'
import { Price } from '@/components/nft/price'
import { RelatedNfts } from '@/components/nft/related-nfts'
import { useNftPurchase } from '@/components/nft/use-nft-purchase'
import { Button, buttonVariants } from '@/components/ui/button'
import { useNft } from '@/features/catalog/queries'
import { compareEth } from '@/lib/money'
import { cn } from '@/lib/utils'

const route = getRouteApi('/nft/$nftId')

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}

/** Voltar do mobile: histórico do app quando existe; senão, o Mercado. */
function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const cls = cn(
    'grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised text-sand transition-colors hover:text-text-accent',
    className,
  )
  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className={cls}>
        <ArrowLeftIcon width={20} height={20} />
      </button>
    )
  }
  return (
    <Link to="/mercado" aria-label="Voltar ao mercado" className={cls}>
      <ArrowLeftIcon width={20} height={20} />
    </Link>
  )
}

/** Detalhe do NFT (Figma "Desktop/Mobile · Detalhes do NFT"). */
export function NftDetailPage() {
  const { nftId } = route.useParams()
  const query = useNft(nftId)
  const isDesktop = useIsDesktop()

  if (!query.data) {
    if (query.isError) {
      const error = toApiError(query.error)
      if (error.code === 'NOT_FOUND') return <NftNotFound />
      return <NftLoadError message={error.message} retrying={query.isFetching} onRetry={() => void query.refetch()} />
    }
    return isDesktop ? (
      <Container className="pb-24 pt-8">
        <NftDetailSkeleton variant="desktop" />
      </Container>
    ) : (
      <NftDetailSkeleton variant="mobile" />
    )
  }

  // `key`: trocar de NFT (relacionados) recomeça a escolha de edição/quantidade.
  return isDesktop ? <DesktopDetail key={query.data.id} nft={query.data} /> : <MobileDetail key={query.data.id} nft={query.data} />
}

function EditionPrice({ nft, priceEth }: { nft: Nft; priceEth: string }) {
  // O preço "de" do resumo vale para o menor preço; só aparece quando a edição é a mais barata.
  const compareAt = nft.compareAtPriceEth && compareEth(priceEth, nft.minPriceEth) === 0 ? nft.compareAtPriceEth : null
  return <Price value={priceEth} compareAt={compareAt} valueClassName="text-title leading-4" compareClassName="text-title-sm" />
}

function DesktopDetail({ nft }: { nft: Nft }) {
  const purchase = useNftPurchase(nft)
  useDocumentTitle(`${nft.title} — Kurio`)

  return (
    <Container className="flex flex-col gap-24 pb-24 pt-8" data-testid="nft-detail">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: nft.title }]} />
        <article aria-labelledby="nft-title" className="grid gap-8 lg:grid-cols-[minmax(0,573fr)_minmax(0,595fr)]">
          <NftGallery images={nft.images} title={nft.title} className="self-start" />
          <div className="flex min-w-0 flex-col gap-5">
            <header className="flex flex-col gap-3 border-b-[0.5px] border-primary/70 pb-3">
              <h1 id="nft-title" className="text-heading-lg font-bold leading-[37px] text-foreground">
                {nft.title}
              </h1>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                {purchase.edition ? <EditionPrice nft={nft} priceEth={purchase.edition.priceEth} /> : null}
                <RatingSummary nft={nft} />
              </div>
            </header>
            <section aria-labelledby="nft-about" className="flex flex-col gap-3">
              <h2 id="nft-about" className="text-body-md font-bold leading-4 text-foreground">
                Sobre este NFT:
              </h2>
              <p className="text-body leading-[22px] text-text-secondary">{nft.description}</p>
            </section>
            <EditionPicker nft={nft} purchase={purchase} />
            <EditionStatusNotice purchase={purchase} />
            <DesktopBuyActions nft={nft} purchase={purchase} />
            <NftMeta nft={nft} />
          </div>
        </article>
      </div>
      <NftDetailTabs nft={nft} />
      <RelatedNfts nftId={nft.id} title="Mais desta coleção" />
    </Container>
  )
}

function MobileDetail({ nft }: { nft: Nft }) {
  const purchase = useNftPurchase(nft)
  useDocumentTitle(`${nft.title} — Kurio`)

  return (
    <div className="flex flex-col" data-testid="nft-detail">
      <div className="bg-linear-to-b from-card to-surface-raised px-6 pb-[84px] pt-6 min-[400px]:px-7">
        <div className="flex items-center justify-between">
          <BackButton />
          <FavoriteButton nft={nft} variant="mobile" />
        </div>
        <NftGalleryMobile images={nft.images} title={nft.title} className="mt-2" />
      </div>
      <article aria-labelledby="nft-title" className="relative -mt-[114px] flex flex-col gap-3 rounded-t-[31px] bg-card px-6 pb-[230px] pt-8">
        <header className="flex items-center justify-between gap-3">
          <h1 id="nft-title" className="min-w-0 text-[1.25rem] font-bold leading-6 text-foreground">
            {nft.title}
          </h1>
          <RatingPill nft={nft} />
        </header>
        <p className="text-body leading-6 text-text-secondary">{nft.description}</p>
        <EditionPicker nft={nft} purchase={purchase} />
        <EditionStatusNotice purchase={purchase} />
        <NftMeta nft={nft} className="mt-1" />
        <NftDetailTabs nft={nft} className="mt-8" />
        <RelatedNfts nftId={nft.id} title="Mais desta coleção" className="mt-10" />
      </article>
      <MobileBuyBar nft={nft} purchase={purchase} />
    </div>
  )
}

/** 404 do NFT: estado próprio da página (o resto do app continua acessível). */
export function NftNotFound() {
  useDocumentTitle('NFT não encontrado — Kurio')
  return (
    <Container className="relative flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center md:py-24" data-testid="nft-not-found">
      <BackButton className="absolute left-6 top-6 md:hidden" />
      <p aria-hidden className="text-display font-bold leading-none text-primary">
        404
      </p>
      <h1 className="text-heading font-bold text-foreground">NFT não encontrado</h1>
      <p className="max-w-md text-body leading-6 text-text-secondary">
        O NFT que você procura não existe, foi removido do mercado ou o link está incorreto.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/mercado" className={buttonVariants({ size: 'lg' })}>
          Explorar o mercado
        </Link>
        <Link to="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Voltar ao início
        </Link>
      </div>
    </Container>
  )
}

function NftLoadError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <Container className="relative flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center md:py-24" data-testid="nft-detail-error">
      <BackButton className="absolute left-6 top-6 md:hidden" />
      <WarningIcon width={36} height={36} className="text-destructive" />
      <h1 className="text-heading font-bold text-foreground">Não foi possível carregar este NFT</h1>
      <p role="alert" className="max-w-md text-body leading-6 text-text-secondary">
        {message} Verifique sua conexão e tente novamente.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" size="lg" onClick={onRetry} loading={retrying}>
          Tentar novamente
        </Button>
        <Link to="/mercado" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Voltar ao mercado
        </Link>
      </div>
    </Container>
  )
}
