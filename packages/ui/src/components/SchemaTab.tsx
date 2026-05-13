import type { ParsedSchema } from '@mock-devtools/core'

interface SchemaTabProps {
  source: string
  error?: string | undefined
  schema?: ParsedSchema | undefined
  onSourceChange(source: string): void
  onParse(): void
}

export function SchemaTab({ source, error, schema, onSourceChange, onParse }: SchemaTabProps) {
  return (
    <div className="mdt-stack">
      <label>
        TypeScript interface
        <textarea value={source} onChange={(event) => onSourceChange(event.target.value)} />
      </label>
      <button type="button" onClick={onParse}>
        Parse schema
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {schema ? (
        <ul>
          {schema.fields.map((field) => (
            <li key={field.name}>
              {field.name}: {field.kind}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
