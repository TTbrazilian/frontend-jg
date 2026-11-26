import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { NftImage } from '@/components/nft/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useFeaturedNfts } from './queries'

/** Destaque da sidebar: o NFT em promoção (preço "de"), ou o último destaque. */
function pickOffer(items: NftSummary[]): NftSummary | undefined {
  return items.find((i) => i.compareAtPriceEth && !i.soldOut) ?? items[items.length - 1]
}

/** Card "NFT EM DESTAQUE / OFERTA LIMITADA" abaixo dos filtros (desktop ≥ 1024px). */
export function FeaturedBanner({ className }: { className?: string }) {
  const featured = useFeaturedNfts()
  const nft = featured.data ? pickOffer(featured.data.items) : undefined
  if (featured.isError || (featured.isSuccess && !nft)) return null

  return (
    <section
      aria-labelledby="featured-banner-title"
      className={cn('flex flex-col gap-4 bg-linear-to-b from-primary/10 to-primary/[0.03] pb-1 pt-6', className)}
    >
      <div className="flex flex-col items-center gap-4 px-5 text-center">
        <h2 id="featured-banner-title" className="w-full text-left text-heading font-bold leading-8 text-text-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="text-title font-bold leading-4 text-foreground">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="group relative block overflow-hidden rounded-[22px] focus-visible:outline-offset-4"
        >
          <NftImage
            image={nft.image}
            sizes="310px"
            decorative
            className="aspect-[310/368] w-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-ink/90 to-transparent px-5 pb-4 pt-10">
            <span className="truncate text-body-lg font-bold text-foreground">{nft.title}</span>
            <span className="text-body-md font-bold text-text-accent">
              {formatEth(nft.minPriceEth)}
              {nft.compareAtPriceEth ? (
                <s className="ml-2 font-normal text-text-secondary">
                  <span className="sr-only">Preço anterior: </span>
                  {formatEth(nft.compareAtPriceEth)}
                </s>
              ) : null}
            </span>
          </span>
        </Link>
      ) : (
        <Skeleton className="aspect-[310/368] w-full rounded-[22px]" />
      )}
    </section>
  )
}
