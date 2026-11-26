import type { ImgHTMLAttributes } from 'react'
import type { NftImage as NftImageData } from '@/api/contracts'
import { cn } from '@/lib/utils'

/** Variante de 480px gerada para cada arte (`nft-N.webp` → `nft-N-480.webp`). */
export function smallVariant(url: string): string {
  return url.endsWith('.webp') && !url.endsWith('-480.webp') ? url.replace(/\.webp$/, '-480.webp') : url
}

export function nftSrcSet(url: string): string | undefined {
  const small = smallVariant(url)
  return small === url ? undefined : `${small} 480w, ${url} 900w`
}

interface NftImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> {
  image: NftImageData
  /** Valor do atributo `sizes` (largura renderizada aproximada). */
  sizes: string
  /** Imagem LCP (hero, imagem principal do detalhe): carrega já, com prioridade alta. */
  priority?: boolean
  /** Imagem decorativa (o texto ao lado já descreve o NFT). */
  decorative?: boolean
}

/** Arte de NFT responsiva: srcSet 480/900, dimensões explícitas (sem CLS) e lazy por padrão. */
export function NftImage({ image, sizes, priority = false, decorative = false, className, ...props }: NftImageProps) {
  return (
    <img
      src={image.url}
      srcSet={nftSrcSet(image.url)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={decorative ? '' : image.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
      draggable={false}
      className={cn('block bg-surface-raised object-cover', className)}
      {...props}
    />
  )
}
