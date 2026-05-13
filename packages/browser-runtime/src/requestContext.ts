export interface UploadFileMetadata {
  fieldName: string
  name: string
  type: string
  size: number
}

export interface RequestContext {
  method: string
  url: URL
  headers: Headers
  json?: unknown
  formData?: FormData
  files: UploadFileMetadata[]
}

export async function readRequestContext(
  method: string,
  url: URL,
  headers: Headers,
  body?: BodyInit | null,
): Promise<RequestContext> {
  const context: RequestContext = {
    method,
    url,
    headers,
    files: [],
  }

  if (body instanceof FormData) {
    context.formData = body
    context.files = Array.from(body.entries())
      .filter((entry): entry is [string, File] => entry[1] instanceof File)
      .map(([fieldName, file]) => ({
        fieldName,
        name: file.name,
        type: file.type,
        size: file.size,
      }))
    return context
  }

  if (typeof body === 'string' && headers.get('content-type')?.includes('application/json')) {
    context.json = JSON.parse(body)
  }

  return context
}
