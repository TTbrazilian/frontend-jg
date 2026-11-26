import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Toasts acessíveis (sonner usa aria-live). Estilizado com os tokens Kurio. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!bg-card !text-foreground !border !border-border-soft !font-sans !rounded-md !shadow-overlay',
          description: '!text-text-secondary',
          actionButton: '!bg-primary !text-primary-foreground !font-bold',
          cancelButton: '!bg-surface-raised !text-text-secondary',
          success: '[&_[data-icon]]:!text-success',
          error: '[&_[data-icon]]:!text-destructive',
        },
      }}
      {...props}
    />
  )
}
