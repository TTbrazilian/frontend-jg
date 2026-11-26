import { Outlet } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { SessionExpiredDialog } from '@/features/auth/session-expired-dialog'
import { PendingOrderBanner } from '@/features/checkout/pending-order-banner'
import { MockPanel } from '@/components/layout/mock-panel'
import { useSessionBootstrap } from '@/features/auth/hooks'

export function RootLayout() {
  useSessionBootstrap()
  return (
    <>
      <a href="#conteudo" className="sr-only-focusable fixed left-4 top-4 z-[100] rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">
        Pular para o conteúdo
      </a>
      <AppLayout>
        <PendingOrderBanner />
        <Outlet />
      </AppLayout>
      <SessionExpiredDialog />
      {import.meta.env.VITE_ENABLE_MOCKS === 'true' ? <MockPanel /> : null}
    </>
  )
}
