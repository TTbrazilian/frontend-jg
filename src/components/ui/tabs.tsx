import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('flex items-center gap-6 overflow-x-auto', className)} {...props} />
))
TabsList.displayName = 'TabsList'

/** Aba do Figma: texto claro; ativa em laranja com sublinhado. */
export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'shrink-0 border-b-2 border-transparent pb-1 text-body-md font-medium text-foreground transition-colors',
      'hover:text-text-accent data-[state=active]:border-primary data-[state=active]:text-text-accent',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />)
TabsContent.displayName = 'TabsContent'
