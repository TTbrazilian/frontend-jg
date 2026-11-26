import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-light active:bg-brand-dark',
        outline: 'border border-primary bg-transparent text-text-accent hover:bg-primary/10',
        secondary: 'bg-surface-raised text-text-secondary hover:bg-surface-dark',
        ghost: 'bg-transparent text-foreground hover:bg-surface-raised',
        link: 'bg-transparent text-text-accent underline-offset-4 hover:underline px-0 h-auto font-medium',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-body',
        default: 'h-10 rounded-md px-5 text-body',
        lg: 'h-12 rounded-md px-6 text-body-lg',
        xl: 'h-[60px] rounded-[30px] px-8 text-title-sm',
        icon: 'size-10 rounded-md',
        'icon-sm': 'size-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
