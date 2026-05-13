interface TriggerButtonProps {
  enabled: boolean
  status: 'idle' | 'matched' | 'error'
  onClick(): void
}

export function TriggerButton({ enabled, status, onClick }: TriggerButtonProps) {
  const state = !enabled ? 'disabled' : status

  return (
    <button className={`mdt-trigger mdt-trigger-${state}`} type="button" onClick={onClick} aria-label="Open Mock DevTools">
      Mock
    </button>
  )
}
