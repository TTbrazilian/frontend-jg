import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { ArrowRightIcon } from '@/components/icons'
import { useIsDesktop, usePrefersReducedMotion } from '@/components/layout/use-media-query'
import { NftImage } from '@/components/nft/nft-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useFeaturedNfts } from './queries'

const AUTOPLAY_MS = 6000
const MAX_SLIDES = 5

/**
 * Carrossel de destaques: avança sozinho a cada 6s, pausa com mouse/foco dentro dele ou pelo botão
 * de pausa (WCAG 2.2.2) e não anda com `prefers-reduced-motion`.
 */
function useHeroCarousel(count: number) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const autoplay = !reduced && count > 1
  const running = autoplay && !paused && !interacting

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => window.clearInterval(t)
  }, [running, count])

  const safeIndex = count ? index % count : 0
  return {
    index: safeIndex,
    setIndex,
    autoplay,
    paused,
    togglePaused: () => setPaused((p) => !p),
    running,
    bind: {
      onMouseEnter: () => setInteracting(true),
      onMouseLeave: () => setInteracting(false),
      onFocus: () => setInteracting(true),
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInteracting(false)
      },
    },
  }
}

type Carousel = ReturnType<typeof useHeroCarousel>

function Dots({ items, carousel, className, size = 'md' }: { items: NftSummary[]; carousel: Carousel; className?: string; size?: 'sm' | 'md' }) {
  if (items.length < 2) return null
  const dot = size === 'sm' ? 'h-[7px]' : 'h-2'
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div role="group" aria-label="Escolher destaque" className="flex items-center">
        {items.map((item, i) => {
          const active = i === carousel.index
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => carousel.setIndex(i)}
              aria-label={`Destaque ${i + 1} de ${items.length}: ${item.title}`}
              aria-current={active ? 'true' : undefined}
              className="grid h-6 min-w-4 place-items-center px-0.5"
            >
              <span
                aria-hidden
                className={cn(
                  'rounded-full bg-primary transition-all',
                  dot,
                  active ? (size === 'sm' ? 'w-[18px]' : 'w-5') : cn(size === 'sm' ? 'w-[7px]' : 'w-2', 'opacity-60'),
                )}
              />
            </button>
          )
        })}
      </div>
      {carousel.autoplay ? (
        <button
          type="button"
          onClick={carousel.togglePaused}
          aria-label={carousel.paused ? 'Retomar rotação dos destaques' : 'Pausar rotação dos destaques'}
          aria-pressed={carousel.paused}
          className="grid size-6 place-items-center rounded-full text-text-accent hover:text-foreground"
        >
          {carousel.paused ? (
            <span aria-hidden className="ml-0.5 size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
          ) : (
            <span aria-hidden className="flex gap-[3px]">
              <span className="h-2.5 w-[3px] rounded-[1px] bg-current" />
              <span className="h-2.5 w-[3px] rounded-[1px] bg-current" />
            </span>
          )}
        </button>
      ) : null}
    </div>
  )
}

/** Imagens empilhadas (crossfade); só a primeira é a imagem LCP (eager + fetchPriority alta). */
function SlideImages({ items, index, sizes, className }: { items: NftSummary[]; index: number; sizes: string; className?: string }) {
  return (
    <>
      {items.map((item, i) => (
        <NftImage
          key={item.id}
          image={item.image}
          sizes={sizes}
          priority={i === 0}
          decorative
          aria-hidden
          className={cn(
            'absolute inset-0 size-full transition-opacity duration-700',
            i === index ? 'opacity-100' : 'opacity-0',
            className,
          )}
        />
      ))}
    </>
  )
}

interface HomeHeroProps {
  /** EXPLORAR: rola até a grade do catálogo e move o foco para ela. */
  onExplore: () => void
}

export function HomeHero({ onExplore }: HomeHeroProps) {
  const isDesktop = useIsDesktop()
  const featured = useFeaturedNfts()
  const items = (featured.data?.items ?? []).slice(0, MAX_SLIDES)
  const carousel = useHeroCarousel(items.length)
  const current = items[carousel.index]
  const state = featured.isPending ? 'loading' : items.length ? 'ready' : 'none'
  return isDesktop ? (
    <DesktopHero items={items} current={current} state={state} carousel={carousel} onExplore={onExplore} />
  ) : (
    <MobileHero items={items} current={current} state={state} carousel={carousel} onExplore={onExplore} />
  )
}

interface HeroViewProps extends HomeHeroProps {
  items: NftSummary[]
  current: NftSummary | undefined
  state: 'loading' | 'ready' | 'none'
  carousel: Carousel
}

function DesktopHero({ items, current, state, carousel, onExplore }: HeroViewProps) {
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da Kurio"
      className={cn('grid min-h-[450px] items-center gap-10 lg:pl-10', state !== 'none' && 'md:grid-cols-[minmax(0,600px)_minmax(0,450px)] md:justify-between')}
      {...carousel.bind}
    >
      <div className="flex flex-col gap-11 py-6">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-2">
              <p className="text-body font-medium leading-4 tracking-[0.1em] text-foreground">Bem-vindo à Kurio</p>
              <h1 className="text-heading-lg font-bold uppercase leading-[1.5] text-foreground lg:text-display lg:leading-[70px]">
                Seja dono do futuro
                <br />
                da arte digital
              </h1>
            </div>
            <p className="max-w-[557px] text-body leading-6 text-text-secondary">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura
              da internet.
            </p>
          </div>
          <Button type="button" onClick={onExplore} className="h-10 w-[140px] text-body-lg">
            EXPLORAR
          </Button>
        </div>
        {state === 'ready' ? <Dots items={items} carousel={carousel} className="self-end" /> : <div aria-hidden className="h-6" />}
      </div>

      {state === 'loading' ? <Skeleton className="aspect-square w-full max-w-[450px] justify-self-end rounded-3xl" /> : null}
      {state === 'ready' && current ? (
        <div className="relative aspect-square w-full max-w-[450px] justify-self-end">
          <Link
            to="/nft/$nftId"
            params={{ nftId: current.id }}
            className="group relative block size-full overflow-hidden rounded-3xl bg-card focus-visible:outline-offset-4"
            aria-roledescription="slide"
          >
            <SlideImages items={items} index={carousel.index} sizes="(min-width: 1024px) 450px, 45vw" className="group-hover:scale-[1.01]" />
            <span
              aria-live={carousel.running ? 'off' : 'polite'}
              className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] flex-col rounded-lg bg-ink/75 px-3 py-2 backdrop-blur-sm"
            >
              <span className="sr-only">Ver destaque: </span>
              <span className="truncate text-body font-bold text-foreground">{current.title}</span>
              <span className="text-body font-bold text-text-accent">{formatEth(current.minPriceEth)}</span>
            </span>
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function MobileHero({ items, current, state, carousel, onExplore }: HeroViewProps) {
  const next = items.length > 1 ? items[(carousel.index + 1) % items.length] : undefined
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da Kurio"
      className="relative isolate overflow-hidden rounded-[30px] bg-linear-to-b from-primary/20 to-primary/10 px-4 pb-1.5 pt-1.5"
      {...carousel.bind}
    >
      <span aria-hidden className="absolute -left-20 -top-8 -z-10 size-[248px] rounded-full bg-linear-to-b from-brand-light/40 to-primary/5" />
      <span aria-hidden className="absolute -top-2.5 left-[73px] -z-10 size-[248px] rounded-full bg-linear-to-b from-brand-light/35 to-transparent" />
      <div className="flex min-h-[156px] items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-caption font-medium leading-4 text-foreground">Bem-vindo à Kurio</p>
          <h1 className="mt-1.5 text-title-sm font-bold uppercase leading-[29px] text-foreground">
            Seja dono da
            <br />
            cultura digital
          </h1>
          <p className="mt-1.5 text-caption leading-[18px] text-text-secondary">Descubra NFTs selecionados de criadores do mundo todo.</p>
          <button
            type="button"
            onClick={onExplore}
            className="-ml-1 mt-1 flex w-fit items-center gap-2 rounded-xs px-1 py-1 text-caption font-bold leading-[14px] text-text-accent"
          >
            EXPLORAR
            <ArrowRightIcon width={16} height={16} />
          </button>
        </div>
        {state === 'loading' ? <Skeleton className="aspect-square w-[40%] max-w-[138px] shrink-0 rounded-xl" /> : null}
        {state === 'ready' && current ? (
          <div className="relative aspect-square w-[40%] max-w-[138px] shrink-0">
            <Link
              to="/nft/$nftId"
              params={{ nftId: current.id }}
              className="relative block size-full overflow-hidden rounded-xl bg-card"
              aria-roledescription="slide"
            >
              <SlideImages items={items} index={carousel.index} sizes="138px" />
              <span className="sr-only" aria-live={carousel.running ? 'off' : 'polite'}>
                Ver destaque: {current.title}, {formatEth(current.minPriceEth)}
              </span>
            </Link>
            {next ? (
              <NftImage
                image={next.image}
                sizes="58px"
                decorative
                aria-hidden
                className="pointer-events-none absolute -bottom-2 left-[10%] size-[42%] rounded-xl border-2 border-card/60"
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {state === 'ready' ? <Dots items={items} carousel={carousel} size="sm" className="justify-center" /> : <div aria-hidden className="h-6" />}
    </section>
  )
}
