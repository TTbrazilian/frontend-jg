import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Largura útil dos frames desktop do Figma (1200px) com respiro lateral responsivo. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-[calc(var(--container)+3rem)] px-6', className)} {...props} />
}
