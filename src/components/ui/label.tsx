import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-body-md leading-none text-foreground', className)} {...props}>
    {children}
    {required ? (
      <span aria-hidden className="ml-0.5 align-top text-coral">
        *
      </span>
    ) : null}
  </LabelPrimitive.Root>
))
Label.displayName = 'Label'
