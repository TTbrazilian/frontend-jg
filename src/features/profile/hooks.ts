import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import type { ChangePasswordRequest, UpdateProfileRequest, User } from '@/api/contracts'
import { qk } from '@/api/query-keys'
import { sessionStore } from '@/app/session-store'
import { useScope } from '@/features/auth/use-scope'

export function useProfile() {
  const { scope, isAuthenticated } = useScope()
  return useQuery({
    queryKey: qk.profile(scope),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

function useApplyUser() {
  const queryClient = useQueryClient()
  const { scope } = useScope()
  return (user: User) => {
    queryClient.setQueryData(qk.profile(scope), user)
    sessionStore.updateUser(user)
  }
}

export function useUpdateProfile() {
  const apply = useApplyUser()
  return useMutation({ mutationFn: (body: UpdateProfileRequest) => api.profile.update(body), onSuccess: apply })
}

export function useUploadAvatar() {
  const apply = useApplyUser()
  return useMutation({ mutationFn: (file: File) => api.profile.uploadAvatar(file), onSuccess: apply })
}

export function useRemoveAvatar() {
  const apply = useApplyUser()
  return useMutation({ mutationFn: () => api.profile.removeAvatar(), onSuccess: apply })
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: ChangePasswordRequest) => api.profile.changePassword(body) })
}
