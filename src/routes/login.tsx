import { useSearch } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/components/auth-screen'

/** /login — modal "Sign In Modal" (desktop) ou página "Mobile / Login". */
export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  return <AuthScreen mode="login" redirect={redirect} />
}
