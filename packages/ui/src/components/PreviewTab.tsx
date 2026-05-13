interface PreviewTabProps {
  preview: string
  onRegenerate(): void
}

export function PreviewTab({ preview, onRegenerate }: PreviewTabProps) {
  return (
    <div className="mdt-stack">
      <button type="button" onClick={onRegenerate}>
        Regenerate preview
      </button>
      <pre data-testid="preview-json">{preview}</pre>
    </div>
  )
}
