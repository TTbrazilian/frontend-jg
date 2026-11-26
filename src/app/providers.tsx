import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from './query-client'
import { RealtimeProvider } from '@/realtime/realtime-provider'
import { Toaster } from '@/components/ui/sonner'
import { LiveRegion } from '@/components/layout/live-region'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        {children}
        <Toaster />
        <LiveRegion />
      </RealtimeProvider>
    </QueryClientProvider>
  )
}
