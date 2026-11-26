import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { User } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { ImageIcon } from '@/components/icons'
import { announce } from '@/components/layout/live-region'
import { Button } from '@/components/ui/button'
import { useRemoveAvatar, useUploadAvatar } from '@/features/profile/hooks'

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const AVATAR_MAX_BYTES = 1024 * 1024

function validateFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use uma imagem PNG, JPEG ou WebP.'
  if (file.size > AVATAR_MAX_BYTES) return 'A imagem deve ter no máximo 1 MB.'
  return null
}

/**
 * Avatar: círculo com a imagem atual (ou ícone), "Alterar" abre o seletor de arquivo
 * com preview imediato e upload; "Remover" apaga no servidor. Independente do "Salvar".
 */
export function AvatarField({ user }: { user: User }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const uid = useId()
  const labelId = `${uid}-label`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`

  const setPreviewUrl = (url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  const busy = upload.isPending || remove.isPending
  const src = preview ?? user.avatarUrl

  const onFile = (file: File | undefined) => {
    if (!file) return
    const invalid = validateFile(file)
    if (invalid) {
      setError(invalid)
      announce(invalid, 'assertive')
      return
    }
    setError(null)
    setPreviewUrl(URL.createObjectURL(file))
    upload.mutate(file, {
      onSuccess: () => {
        toast.success('Avatar atualizado.')
        announce('Avatar atualizado.')
      },
      onError: (err) => {
        const apiError = toApiError(err)
        setError(apiError.fieldErrors.avatar ?? apiError.message)
      },
      onSettled: () => setPreviewUrl(null),
    })
  }

  const onRemove = () => {
    setError(null)
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Avatar removido.')
        announce('Avatar removido.')
      },
      onError: (err) => setError(toApiError(err).message),
    })
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2.5">
      <span id={labelId} className="text-body-md leading-[15px] text-foreground">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-6">
        <span className="grid size-[50px] shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-raised text-text-accent" aria-busy={busy || undefined}>
          {src ? (
            <img src={src} alt="Seu avatar" data-testid="avatar-image" className="size-full object-cover" width={50} height={50} />
          ) : (
            <ImageIcon title="Sem avatar" width={24} height={24} />
          )}
        </span>
        <div className="flex items-center gap-5">
          <input
            ref={inputRef}
            id={`${uid}-file`}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(' ')}
            aria-label="Arquivo do avatar"
            data-testid="avatar-input"
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            loading={upload.isPending}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="h-10 w-[98px] rounded-xs px-0"
            aria-describedby={hintId}
          >
            Alterar<span className="sr-only"> avatar</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            loading={remove.isPending}
            disabled={busy || !user.avatarUrl}
            onClick={onRemove}
            data-testid="avatar-remove"
            className="h-10 px-2 font-normal"
          >
            Remover<span className="sr-only"> avatar</span>
          </Button>
        </div>
      </div>
      <p id={hintId} className="text-caption text-sand">
        PNG, JPEG ou WebP, até 1 MB.
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-caption font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
