import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createMockDevtoolsRuntime,
  loadState,
  saveState,
  type PersistedMockDevtoolsState,
  type RequestLogEntry,
} from '@mock-devtools/browser-runtime'
import {
  generateFakeData,
  listTypeSchemaNames,
  parseInterfaceSchema,
  type BodyMatcher,
  type HeaderMatcher,
  type MockRoute,
} from '@mock-devtools/core'
import { DevtoolsPanel } from './components/DevtoolsPanel'
import { LogsTab } from './components/LogsTab'
import { RoutesTab } from './components/RoutesTab'
import { SettingsTab } from './components/SettingsTab'
import { TriggerButton } from './components/TriggerButton'
import './styles.css'

export interface AppProps {
  defaultOpen?: boolean
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  storageKey?: string
  serviceWorkerUrl?: string
  initialLogs?: RequestLogEntry[]
  schemaResolverUrl?: string
  onStateChange?(state: PersistedMockDevtoolsState): void
}

export interface RouteDraft {
  method: MockRoute['method']
  urlPattern: string
  headerName: string
  headerOperator: HeaderMatcher['operator']
  headerValue: string
  bodyOperator: BodyMatcher['operator']
  bodyJson: string
  delayMs: string
  status: string
  responseShape: MockRoute['response']['shape']
  responseHeaderName: string
  responseHeaderValue: string
  itemCount: string
  responseJson: string
  generatorSource: string
  generatorSchemaName: string
  generatorPreview: string
}

const defaultState: PersistedMockDevtoolsState = {
  enabled: false,
  routes: [],
  logPassThrough: false,
  backendOrigin: '',
  proxySyncUrl: '',
}

const defaultDraft: RouteDraft = {
  method: 'GET',
  urlPattern: '/api/example',
  headerName: '',
  headerOperator: 'exists',
  headerValue: '',
  bodyOperator: 'contains',
  bodyJson: '',
  delayMs: '0',
  status: '200',
  responseShape: 'object',
  responseHeaderName: '',
  responseHeaderValue: '',
  itemCount: '10',
  responseJson: '',
  generatorSource: '',
  generatorSchemaName: '',
  generatorPreview: '',
}

type RouteEditorTab = 'Request' | 'Custom Response' | 'Manual Response'
const panelCloseAnimationMs = 180

export function App({
  defaultOpen = false,
  position = 'bottom-right',
  storageKey = 'mock-devtools',
  serviceWorkerUrl,
  initialLogs = [],
  schemaResolverUrl,
  onStateChange,
}: AppProps) {
  const storedState = typeof localStorage === 'undefined' ? undefined : loadState(localStorage, storageKey)
  const [open, setOpen] = useState(defaultOpen)
  const [renderPanel, setRenderPanel] = useState(defaultOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState('Routes')
  const [routeEditorTab, setRouteEditorTab] = useState<RouteEditorTab>('Request')
  const [state, setState] = useState<PersistedMockDevtoolsState>(storedState ?? defaultState)
  const [draft, setDraft] = useState<RouteDraft>(defaultDraft)
  const [editingRouteId, setEditingRouteId] = useState<string | undefined>()
  const [routeError, setRouteError] = useState<string | undefined>()
  const [schemaWarnings, setSchemaWarnings] = useState<string[]>([])
  const [logs, setLogs] = useState<RequestLogEntry[]>(initialLogs)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const runtime = useMemo(
    () =>
      createMockDevtoolsRuntime({
        ...state,
        ...(serviceWorkerUrl === undefined ? {} : { serviceWorkerUrl }),
      }),
    [serviceWorkerUrl],
  )
  const generatorSchemaNames = useMemo(() => listTypeSchemaNames(draft.generatorSource), [draft.generatorSource])

  useEffect(() => {
    runtime.start()
    return () => runtime.stop()
  }, [runtime])

  useEffect(() => {
    return () => {
      clearCloseTimer()
    }
  }, [])

  useEffect(() => {
    runtime.update(state)
    if (typeof localStorage !== 'undefined') {
      saveState(localStorage, storageKey, state)
    }
    onStateChange?.(state)
  }, [onStateChange, runtime, state, storageKey])

  useEffect(() => {
    if (activeTab === 'Logs' && initialLogs.length === 0) {
      setLogs(runtime.getLogs())
    }
  }, [activeTab, initialLogs.length, runtime])

  function updateState(nextState: PersistedMockDevtoolsState): void {
    setState(nextState)
  }

  function updateDraft(patch: Partial<RouteDraft>): void {
    setDraft((current) => ({ ...current, ...patch }))
    setRouteError(undefined)
    if ('generatorSource' in patch || 'generatorSchemaName' in patch) {
      setSchemaWarnings([])
    }
  }

  function saveDraftRoute(): void {
    try {
      const route = createRoute(editingRouteId ?? `route-${Date.now()}`, draft)
      updateState({
        ...state,
        routes: editingRouteId
          ? state.routes.map((candidate) => (candidate.id === editingRouteId ? route : candidate))
          : [...state.routes, route],
      })
      setEditingRouteId(undefined)
      setDraft(defaultDraft)
      setRouteEditorTab('Request')
      setRouteError(undefined)
      setSchemaWarnings([])
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Route could not be saved.')
    }
  }

  function startNewRoute(): void {
    setDraft(defaultDraft)
    setEditingRouteId(undefined)
    setRouteEditorTab('Request')
    setRouteError(undefined)
    setSchemaWarnings([])
  }

  function editRoute(route: MockRoute): void {
    setDraft(routeToDraft(route))
    setEditingRouteId(route.id)
    setRouteEditorTab('Request')
    setRouteError(undefined)
    setSchemaWarnings([])
  }

  function duplicateRoute(route: MockRoute): void {
    setDraft(routeToDraft(route))
    setEditingRouteId(undefined)
    setRouteEditorTab('Request')
    setRouteError(undefined)
    setSchemaWarnings([])
  }

  function toggleRoute(id: string): void {
    updateState({
      ...state,
      routes: state.routes.map((route) => (route.id === id ? { ...route, enabled: !route.enabled } : route)),
    })
  }

  function deleteRoute(id: string): void {
    updateState({ ...state, routes: state.routes.filter((route) => route.id !== id) })
    if (editingRouteId === id) {
      startNewRoute()
    }
  }

  async function generateResponsePreview(): Promise<void> {
    try {
      if (draft.responseShape === 'empty') {
        updateDraft({ generatorPreview: '', responseJson: '' })
        setSchemaWarnings([])
        return
      }

      if (draft.responseShape === 'null') {
        updateDraft({ generatorPreview: 'null' })
        setSchemaWarnings([])
        return
      }

      const schemaName = draft.generatorSchemaName || undefined
      const resolvedSchema = schemaResolverUrl
        ? await resolveSchemaWithAdapterFallback(schemaResolverUrl, draft.generatorSource, schemaName)
        : { schema: parseInterfaceSchema(draft.generatorSource, { schemaName }), warnings: [] }
      const itemCount = Number.parseInt(draft.itemCount, 10)
      const count = Number.isFinite(itemCount) && itemCount > 0 ? itemCount : 10
      const generated =
        draft.responseShape === 'array' || draft.responseShape === 'paginated'
          ? generateFakeData(resolvedSchema.schema, { count })
          : generateFakeData(resolvedSchema.schema)
      const body = draft.responseShape === 'paginated' ? { data: generated, meta: { page: 1, pageSize: count, total: count } } : generated

      setSchemaWarnings(resolvedSchema.warnings)
      updateDraft({ generatorPreview: JSON.stringify(body, null, 2) })
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Response model could not be generated.')
      setSchemaWarnings([])
      updateDraft({ generatorPreview: '' })
    }
  }

  function useGeneratedResponse(): void {
    updateDraft({ responseJson: draft.generatorPreview })
    setRouteEditorTab('Manual Response')
  }

  function clearLogs(): void {
    runtime.clearLogs()
    setLogs([])
  }

  function clearCloseTimer(): void {
    if (closeTimerRef.current !== undefined) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
  }

  function openPanel(): void {
    clearCloseTimer()
    setRenderPanel(true)
    setIsClosing(false)
    setOpen(true)
  }

  function closePanel(): void {
    clearCloseTimer()
    setOpen(false)
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setRenderPanel(false)
      setIsClosing(false)
      closeTimerRef.current = undefined
    }, panelCloseAnimationMs)
  }

  function togglePanel(): void {
    if (open && !isClosing) {
      closePanel()
      return
    }

    openPanel()
  }

  return (
    <div className={`mdt-root mdt-${position}`}>
      <TriggerButton enabled={state.enabled} status="idle" onClick={togglePanel} />
      {renderPanel ? (
        <DevtoolsPanel
          activeTab={activeTab}
          mockingEnabled={state.enabled}
          animationState={isClosing ? 'closing' : 'open'}
          onTabChange={setActiveTab}
          onMockingEnabledChange={(enabled) => updateState({ ...state, enabled })}
        >
          {activeTab === 'Routes' ? (
            <RoutesTab
              routes={state.routes}
              draft={draft}
              editorTab={routeEditorTab}
              editingRouteId={editingRouteId}
              error={routeError}
              schemaWarnings={schemaWarnings}
              onDraftChange={updateDraft}
              onEditorTabChange={setRouteEditorTab}
              availableModelNames={generatorSchemaNames}
              onGeneratePreview={generateResponsePreview}
              onUseGeneratedResponse={useGeneratedResponse}
              onSaveRoute={saveDraftRoute}
              onNewRoute={startNewRoute}
              onEditRoute={editRoute}
              onDuplicateRoute={duplicateRoute}
              onToggleRoute={toggleRoute}
              onDeleteRoute={deleteRoute}
            />
          ) : null}
          {activeTab === 'Logs' ? <LogsTab logs={logs} onClear={clearLogs} /> : null}
          {activeTab === 'Settings' ? (
            <SettingsTab
              logPassThrough={state.logPassThrough}
              backendOrigin={state.backendOrigin ?? ''}
              proxySyncUrl={state.proxySyncUrl ?? ''}
              onLogPassThroughChange={(logPassThrough) => updateState({ ...state, logPassThrough })}
              onBackendOriginChange={(backendOrigin) => updateState({ ...state, backendOrigin })}
              onProxySyncUrlChange={(proxySyncUrl) => updateState({ ...state, proxySyncUrl })}
              onClearRoutes={() => updateState({ ...state, routes: [] })}
            />
          ) : null}
        </DevtoolsPanel>
      ) : null}
    </div>
  )
}

async function resolveSchemaWithAdapterFallback(
  schemaResolverUrl: string,
  source: string,
  schemaName?: string,
): Promise<ResolveSchemaResult> {
  try {
    const fetchSchema =
      typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : globalThis.fetch?.bind(globalThis)
    if (!fetchSchema) {
      throw new Error('Fetch is not available.')
    }

    const response = await fetchSchema(schemaResolverUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source, schemaName }),
    })
    const payload = (await response.json()) as AdapterSchemaPayload
    if (!response.ok || !payload.schema) {
      throw new Error(payload.error ?? 'Project schema could not be resolved.')
    }
    return { schema: payload.schema, warnings: formatUnresolvedImports(payload.unresolvedImports ?? []) }
  } catch {
    return { schema: parseInterfaceSchema(source, { schemaName }), warnings: formatUnresolvedImports(findImportedTypes(source)) }
  }
}

interface ResolveSchemaResult {
  schema: ReturnType<typeof parseInterfaceSchema>
  warnings: string[]
}

interface AdapterSchemaPayload {
  schema?: ReturnType<typeof parseInterfaceSchema>
  unresolvedImports?: AdapterUnresolvedImport[]
  error?: string
}

type AdapterUnresolvedImport = string | { name?: string; specifier?: string }

function formatUnresolvedImports(imports: AdapterUnresolvedImport[]): string[] {
  const formatted = imports.map(formatUnresolvedImport).filter((value): value is string => value !== undefined)
  return formatted.length > 0 ? [`Unresolved imports: ${formatted.join(', ')}`] : []
}

function formatUnresolvedImport(importedType: AdapterUnresolvedImport): string | undefined {
  if (typeof importedType === 'string') {
    return importedType
  }

  if (!importedType.name) {
    return undefined
  }

  return importedType.specifier ? `${importedType.name} from "${importedType.specifier}"` : importedType.name
}

function findImportedTypes(source: string): AdapterUnresolvedImport[] {
  const imports: AdapterUnresolvedImport[] = []
  const importPattern = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g

  for (const match of source.matchAll(importPattern)) {
    const names = match[1] ?? ''
    const specifier = match[2]
    if (!specifier) {
      continue
    }

    for (const name of names.split(',')) {
      const importedName = name.trim().split(/\s+as\s+/)[0]?.trim()
      if (importedName) {
        imports.push({ name: importedName, specifier })
      }
    }
  }

  return imports
}

function createRoute(id: string, draft: RouteDraft): MockRoute {
  const status = Number.parseInt(draft.status, 10)
  const delayMs = Number.parseInt(draft.delayMs, 10)
  const itemCount = Number.parseInt(draft.itemCount, 10)
  const responseHeaders =
    draft.responseHeaderName && draft.responseHeaderValue ? { [draft.responseHeaderName]: draft.responseHeaderValue } : {}
  const responseBody = parseOptionalJson(draft.responseJson, 'Manual response JSON')
  const requestBody = supportsRequestBody(draft.method) && draft.bodyJson.trim()
    ? { requestBody: { operator: draft.bodyOperator, json: parseOptionalJson(draft.bodyJson, 'Body JSON') } }
    : {}

  return {
    id,
    enabled: true,
    method: draft.method,
    urlPattern: draft.urlPattern,
    requestHeaders: draft.headerName
      ? [
          {
            name: draft.headerName,
            operator: draft.headerOperator,
            ...(draft.headerOperator !== 'exists' && draft.headerValue ? { value: draft.headerValue } : {}),
          },
        ]
      : [],
    ...requestBody,
    ...(Number.isFinite(delayMs) && delayMs > 0 ? { delayMs } : {}),
    response: {
      status: Number.isFinite(status) ? status : 200,
      headers: responseHeaders,
      shape: draft.responseShape,
      ...(draft.generatorSource.trim() ? { schemaSource: draft.generatorSource } : {}),
      ...(draft.generatorSchemaName ? { schemaName: draft.generatorSchemaName } : {}),
      ...(Number.isFinite(itemCount) && itemCount > 0 ? { itemCount } : {}),
      ...(responseBody === undefined ? {} : { body: responseBody }),
    },
  }
}

function routeToDraft(route: MockRoute): RouteDraft {
  const [header] = route.requestHeaders
  const responseHeader = Object.entries(route.response.headers)[0]

  return {
    method: route.method,
    urlPattern: route.urlPattern,
    headerName: header?.name ?? '',
    headerOperator: header?.operator ?? 'exists',
    headerValue: header?.value ?? '',
    bodyOperator: route.requestBody?.operator ?? 'contains',
    bodyJson: route.requestBody ? JSON.stringify(route.requestBody.json, null, 2) : '',
    delayMs: typeof route.delayMs === 'number' ? String(route.delayMs) : '0',
    status: String(route.response.status),
    responseShape: route.response.shape,
    responseHeaderName: responseHeader?.[0] ?? '',
    responseHeaderValue: responseHeader?.[1] ?? '',
    itemCount: String(route.response.itemCount ?? 10),
    responseJson: route.response.body === undefined ? '' : JSON.stringify(route.response.body, null, 2),
    generatorSource: route.response.schemaSource ?? '',
    generatorSchemaName: route.response.schemaName ?? '',
    generatorPreview: '',
  }
}

function supportsRequestBody(method: MockRoute['method']): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH'
}

function parseOptionalJson(value: string | undefined, label: string): unknown {
  if (!value?.trim()) {
    return undefined
  }

  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }
}
