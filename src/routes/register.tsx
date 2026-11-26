import { useSearch } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/components/auth-screen'

/** /cadastro — modal "Sign Up Modal" (desktop) ou página "Mobile / Cadastro". */
export function RegisterPage() {
  const { redirect } = useSearch({ from: '/cadastro' })
  return <AuthScreen mode="register" redirect={redirect} />
}
