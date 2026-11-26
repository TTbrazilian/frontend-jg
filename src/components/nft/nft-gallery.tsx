import { useEffect, useRef, useState } from 'react'
import type { NftImage as NftImageData } from '@/api/contracts'
import { ArrowLeftIcon, ChevronRightIcon, SearchIcon } from '@/components/icons'
import { usePrefersReducedMotion } from '@/components/layout/use-media-query'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { NftImage } from './nft-image'

interface GalleryProps {
  images: NftImageData[]
  title: string
  className?: string
}

/** Diálogo de zoom (foco preso e devolvido pelo Radix; setas trocam a imagem). */
function ZoomDialog({ images, title, index, onIndex, open, onOpenChange }: GalleryProps & { index: number; onIndex: (i: number) => void; open: boolean; onOpenChange: (o: boolean) => void }) {
  const image = images[index]
  const many = images.length > 1
  const go = (dir: 1 | -1) => onIndex((index + dir + images.length) % images.length)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(92vw,860px)] gap-4 p-4 pt-12 md:p-6 md:pt-14"
        closeLabel="Fechar imagem ampliada"
        onKeyDown={(e) => {
          if (!many) return
          if (e.key === 'ArrowRight') go(1)
          if (e.key === 'ArrowLeft') go(-1)
        }}
      >
        <DialogTitle className="absolute left-4 top-4 pr-12 text-body-lg md:left-6">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {image?.alt}. {many ? `Imagem ${index + 1} de ${images.length}. Use as setas para navegar.` : ''}
        </DialogDescription>
        {image ? (
          <img
            src={image.url}
            width={image.width}
            height={image.height}
            alt={image.alt}
            className="mx-auto block max-h-[70dvh] w-auto rounded-xl object-contain"
          />
        ) : null}
        {many ? (
          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => go(-1)} aria-label="Imagem anterior" className="grid size-10 place-items-center rounded-full border border-border bg-surface-raised text-text-accent hover:border-primary">
              <ArrowLeftIcon width={18} height={18} />
            </button>
            <span className="text-body text-text-secondary" aria-live="polite">
              {index + 1} / {images.length}
            </span>
            <button type="button" onClick={() => go(1)} aria-label="Próxima imagem" className="grid size-10 place-items-center rounded-full border border-border bg-surface-raised text-text-accent hover:border-primary">
              <ChevronRightIcon width={18} height={18} />
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Galeria do detalhe (desktop): 4 miniaturas 100px + imagem principal 444px em moldura, lupa no
 * canto que abre o zoom. A imagem principal é a LCP da página (eager, fetchPriority alta).
 */
export function NftGallery({ images, title, className }: GalleryProps) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const current = images[index] ?? images[0]
  if (!current) return null

  return (
    <div className={cn('flex items-center gap-4 lg:gap-7', className)}>
      {images.length > 1 ? (
        <ul className="flex w-[18%] max-w-[100px] shrink-0 flex-col gap-4" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Mostrar imagem ${i + 1} de ${images.length}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'block aspect-square w-full overflow-hidden rounded-lg border bg-card transition-colors',
                  i === index ? 'border-primary' : 'border-transparent hover:border-primary/60',
                )}
              >
                <NftImage image={img} sizes="100px" decorative className="size-full" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="relative aspect-square w-full max-w-[444px] rounded-md bg-card p-[4.5%]">
          <NftImage image={current} sizes="(min-width: 1024px) 404px, 60vw" priority={index === 0} className="size-full rounded-3xl" />
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label="Ampliar imagem"
            aria-haspopup="dialog"
            className="absolute right-[3%] top-[3.4%] grid size-[30px] place-items-center rounded-full border border-border bg-surface-raised text-foreground transition-colors hover:border-primary hover:text-text-accent"
          >
            <SearchIcon width={16} height={16} />
          </button>
        </div>
      </div>
      <ZoomDialog images={images} title={title} index={index} onIndex={setIndex} open={zoom} onOpenChange={setZoom} />
    </div>
  )
}

/**
 * Galeria mobile do Figma: imagem 361×356 com cantos de 24px, deslizável (scroll-snap) e pontos
 * (o atual vira pílula). Tocar na imagem abre o zoom.
 */
export function NftGalleryMobile({ images, title, className }: GalleryProps) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <div className={cn('relative', className)}>
      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={`Imagens de ${title}`}
      >
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className="w-full shrink-0 snap-center">
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label={`Ampliar imagem ${i + 1} de ${images.length}`}
              className="block w-full"
              tabIndex={i === index ? 0 : -1}
            >
              <NftImage image={img} sizes="92vw" priority={i === 0} decorative={i !== 0} className="aspect-[361/356] w-full rounded-3xl" />
            </button>
          </li>
        ))}
      </ul>
      {images.length > 1 ? (
        <div className="absolute inset-x-0 bottom-11 flex justify-center" role="group" aria-label="Escolher imagem">
          {images.map((img, i) => (
            <button
              key={`${img.url}-dot-${i}`}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Imagem ${i + 1} de ${images.length}`}
              aria-current={i === index ? 'true' : undefined}
              className="grid h-6 place-items-center px-[3.5px]"
            >
              <span aria-hidden className={cn('h-[7px] rounded-full bg-primary shadow-card transition-all', i === index ? 'w-7' : 'w-[7px]')} />
            </button>
          ))}
        </div>
      ) : null}
      <ZoomDialog images={images} title={title} index={index} onIndex={(i) => { setIndex(i); goTo(i) }} open={zoom} onOpenChange={setZoom} />
    </div>
  )
}
