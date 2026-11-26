import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { useFeaturedNfts, useRelatedNfts } from '@/features/catalog/queries'
import { usePrefersReducedMotion } from '@/components/layout/use-media-query'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './nft-card'

export interface RelatedNftsProps {
  /** Com `nftId`: relacionados daquele NFT. Sem: destaques do catálogo. */
  nftId?: string
  title: string
  className?: string
}

type ItemsQuery = { data?: { items: NftSummary[] }; isPending: boolean; isError: boolean; isSuccess: boolean }

function RelatedById({ nftId, ...rest }: RelatedNftsProps & { nftId: string }) {
  return <RelatedView query={useRelatedNfts(nftId)} {...rest} />
}

function FeaturedRelated(props: RelatedNftsProps) {
  return <RelatedView query={useFeaturedNfts()} {...props} />
}

/**
 * Carrossel "Mais desta coleção"/"Colecionadores também viram": lista rolável com scroll-snap
 * (arrastar/rolar no toque, Tab percorre os cards) e pontos que levam a cada página do carrossel.
 */
export function RelatedNfts(props: RelatedNftsProps) {
  return props.nftId ? <RelatedById {...props} nftId={props.nftId} /> : <FeaturedRelated {...props} />
}

function RelatedView({ query, title, className }: RelatedNftsProps & { query: ItemsQuery }) {
  const items: NftSummary[] = query.data?.items ?? []
  const headingId = useId()

  if (query.isError || (query.isSuccess && items.length === 0)) return null

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-8', className)} data-testid="related-nfts">
      <div className="flex flex-col gap-3 border-b-[0.5px] border-primary pb-3">
        <h2 id={headingId} className="text-[1.0625rem] font-bold leading-4 text-text-accent">
          {title}
        </h2>
      </div>
      {query.isPending ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-7 lg:grid-cols-5" aria-busy="true">
          <span className="sr-only">Carregando NFTs…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={cn(i >= 2 && 'max-md:hidden', i >= 3 && 'md:max-lg:hidden')}>
              <NftCardSkeleton size="compact" />
            </div>
          ))}
        </div>
      ) : (
        <Carousel items={items} label={title} />
      )}
    </section>
  )
}

function Carousel({ items, label }: { items: NftSummary[]; label: string }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)
  const reduced = usePrefersReducedMotion()

  const measure = useCallback(() => {
    const el = trackRef.current
    // Sem largura (ainda não pintado/oculto): nada a medir — evita divisão por zero (Infinity páginas).
    if (!el || el.clientWidth <= 0) return
    const max = el.scrollWidth - el.clientWidth
    const total = max <= 2 ? 1 : Math.min(items.length, Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.01)))
    setPages(total)
    const ratio = max <= 0 ? 0 : el.scrollLeft / max
    setPage(Math.min(total - 1, Math.round(ratio * (total - 1))))
  }, [items.length])

  useEffect(() => {
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const goTo = (index: number) => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    el.scrollTo({ left: pages <= 1 ? 0 : (max * index) / (pages - 1), behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <ul
        ref={trackRef}
        onScroll={measure}
        aria-label={label}
        className={cn(
          'flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 md:gap-7',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((nft) => (
          <li
            key={nft.id}
            className="w-[calc((100%-1rem)/2)] shrink-0 snap-start md:w-[calc((100%-3.5rem)/3)] lg:w-[calc((100%-7rem)/5)]"
          >
            <NftCard nft={nft} size="compact" />
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center gap-2" role="group" aria-label={`Páginas do carrossel ${label}`}>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir para o grupo ${i + 1} de ${pages}`}
              aria-current={i === page ? 'true' : undefined}
              className="relative grid size-6 place-items-center"
            >
              <span
                aria-hidden
                className={cn('size-3 rounded-full border-[1.3px] border-primary transition-colors', i === page && 'bg-primary')}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
