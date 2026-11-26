import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './styles/index.css'
import { queryClient } from '@/app/query-client'
import { createAppRouter } from '@/router'

const router = createAppRouter(queryClient)

async function bootstrap() {
  // MSW precisa estar ativo ANTES da primeira requisição/conexão de socket.
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { enableMocking } = await import('@/mocks/browser')
    await enableMocking()
  }
  // Import dinâmico: o engine.io-client captura `globalThis.WebSocket` ao carregar o módulo,
  // então o socket.io-client só pode ser avaliado DEPOIS de o MSW instalar o WebSocket simulado.
  const { AppProviders } = await import('@/app/providers')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}

void bootstrap()
