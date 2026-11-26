import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cn } from '@/lib/utils'

/** No Figma o "checkbox" é um círculo (ex.: "Usar outra carteira?"). */
export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-primary',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="size-2 rounded-full bg-primary" />
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'
