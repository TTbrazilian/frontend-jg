import { Link, type LinkProps } from '@tanstack/react-router'
import type { Ref } from 'react'
import { ArrowLeftIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface MobileScreenHeaderProps {
  title: string
  backTo: LinkProps['to']
  backLabel: string
  className?: string
  headingRef?: Ref<HTMLHeadingElement>
}

/**
 * Cabeçalho das telas mobile do Figma: botão voltar circular + título centralizado.
 * No desktop o título continua existindo como h1 só para leitores de tela (o Figma mostra o breadcrumb).
 */
export function MobileScreenHeader({ title, backTo, backLabel, className, headingRef }: MobileScreenHeaderProps) {
  return (
    <div className={cn('relative flex h-11 items-center justify-center md:contents', className)}>
      <Link
        to={backTo}
        aria-label={backLabel}
        className="absolute left-0 top-0 grid size-[35px] place-items-center rounded-full border border-border bg-surface-raised text-sand transition-colors hover:text-text-accent md:hidden"
      >
        <ArrowLeftIcon width={20} height={20} />
      </Link>
      <h1 ref={headingRef} tabIndex={-1} className="px-11 text-center text-[clamp(1rem,4.9vw,1.25rem)] font-bold leading-5 outline-none md:sr-only">
        {title}
      </h1>
    </div>
  )
}
