import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 font-bold uppercase', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      outline: 'border border-primary text-text-accent',
      muted: 'bg-surface-raised text-text-secondary',
      success: 'bg-success/15 text-success border border-success/40',
      warning: 'bg-amber/15 text-amber border border-amber/40',
      destructive: 'bg-destructive/15 text-destructive border border-destructive/40',
    },
    size: { sm: 'px-2 py-0.5 text-tiny rounded-xs', default: 'px-3 py-1 text-caption rounded-sm' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

export function Badge({ className, variant, size, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
