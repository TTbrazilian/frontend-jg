import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-body text-foreground placeholder:text-sand/80',
        'transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        'file:border-0 file:bg-transparent file:text-body file:font-medium',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
