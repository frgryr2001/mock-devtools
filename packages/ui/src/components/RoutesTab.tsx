import type { BodyMatcher, HeaderMatcher, MockResponseConfig, MockRoute } from '@mock-devtools/core'
import type { RouteDraft } from '../App'

type RouteEditorTab = 'Request' | 'Custom Response' | 'Manual Response'

interface RoutesTabProps {
  routes: MockRoute[]
  draft: RouteDraft
  editorTab: RouteEditorTab
  editingRouteId?: string | undefined
  error?: string | undefined
  schemaWarnings: string[]
  availableModelNames: string[]
  onDraftChange(patch: Partial<RouteDraft>): void
  onEditorTabChange(tab: RouteEditorTab): void
  onGeneratePreview(): void
  onUseGeneratedResponse(): void
  onSaveRoute(): void
  onNewRoute(): void
  onEditRoute(route: MockRoute): void
  onDuplicateRoute(route: MockRoute): void
  onToggleRoute(id: string): void
  onDeleteRoute(id: string): void
}

const methods: MockRoute['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const headerOperators: HeaderMatcher['operator'][] = ['exists', 'equals', 'contains', 'startsWith', 'matches']
const bodyOperators: BodyMatcher['operator'][] = ['contains', 'equals']
const responseShapes: MockResponseConfig['shape'][] = ['object', 'array', 'paginated', 'empty', 'null']
const editorTabs: RouteEditorTab[] = ['Request', 'Custom Response', 'Manual Response']

export function RoutesTab({
  routes,
  draft,
  editorTab,
  editingRouteId,
  error,
  schemaWarnings,
  availableModelNames,
  onDraftChange,
  onEditorTabChange,
  onGeneratePreview,
  onUseGeneratedResponse,
  onSaveRoute,
  onNewRoute,
  onEditRoute,
  onDuplicateRoute,
  onToggleRoute,
  onDeleteRoute,
}: RoutesTabProps) {
  const canMatchBody = supportsRequestBody(draft.method)
  const showItemCount = draft.responseShape === 'array' || draft.responseShape === 'paginated'
  const canGenerate = draft.responseShape !== 'empty' && draft.responseShape !== 'null'

  return (
    <div className="mdt-routes">
      <form className="mdt-route-builder mdt-utility-card" aria-label="Route builder">
        <section className="mdt-route-summary mdt-summary-band" aria-label="Route summary">
          <label>
            Method
            <select
              value={draft.method}
              onChange={(event) => onDraftChange({ method: event.target.value as MockRoute['method'] })}
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label className="mdt-field-wide">
            URL pattern
            <input value={draft.urlPattern} onChange={(event) => onDraftChange({ urlPattern: event.target.value })} />
          </label>
          <label>
            Status
            <input inputMode="numeric" value={draft.status} onChange={(event) => onDraftChange({ status: event.target.value })} />
          </label>
          <label>
            Delay ms
            <input inputMode="numeric" value={draft.delayMs} onChange={(event) => onDraftChange({ delayMs: event.target.value })} />
          </label>
        </section>

        <div className="mdt-subtabs" aria-label="Route editor sections">
          {editorTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={editorTab === tab ? 'active' : ''}
              onClick={() => onEditorTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {editorTab === 'Request' ? (
          <section className="mdt-section" aria-label="Request matching">
            <h3>Request matching</h3>
            <div className="mdt-form-grid">
              <label>
                Header name
                <input value={draft.headerName} onChange={(event) => onDraftChange({ headerName: event.target.value })} />
              </label>
              <label>
                Header operator
                <select
                  value={draft.headerOperator}
                  onChange={(event) => onDraftChange({ headerOperator: event.target.value as HeaderMatcher['operator'] })}
                >
                  {headerOperators.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Header value
                <input value={draft.headerValue} onChange={(event) => onDraftChange({ headerValue: event.target.value })} />
              </label>
            </div>

            {canMatchBody ? (
              <div className="mdt-body-match">
                <label>
                  Body match operator
                  <select
                    value={draft.bodyOperator}
                    onChange={(event) => onDraftChange({ bodyOperator: event.target.value as BodyMatcher['operator'] })}
                  >
                    {bodyOperators.map((operator) => (
                      <option key={operator} value={operator}>
                        {operator}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Body JSON
                  <textarea
                    value={draft.bodyJson}
                    onChange={(event) => onDraftChange({ bodyJson: event.target.value })}
                    placeholder='{"role":"admin"}'
                  />
                </label>
              </div>
            ) : null}
          </section>
        ) : null}

        {editorTab === 'Custom Response' ? (
          <section className="mdt-section" aria-label="Custom response">
            <h3>Custom response</h3>
            <div className="mdt-form-grid">
              <label>
                Response shape
                <select
                  value={draft.responseShape}
                  onChange={(event) => onDraftChange({ responseShape: event.target.value as MockResponseConfig['shape'] })}
                >
                  {responseShapes.map((shape) => (
                    <option key={shape} value={shape}>
                      {shape}
                    </option>
                  ))}
                </select>
              </label>
              {showItemCount ? (
                <label>
                  Item count
                  <input
                    inputMode="numeric"
                    value={draft.itemCount}
                    onChange={(event) => onDraftChange({ itemCount: event.target.value })}
                  />
                </label>
              ) : null}
            </div>
            {canGenerate ? (
              <>
                <label>
                  TypeScript response model
                  <textarea
                    value={draft.generatorSource}
                    onChange={(event) => onDraftChange({ generatorSource: event.target.value, generatorSchemaName: '' })}
                  />
                </label>
                {availableModelNames.length > 0 ? (
                  <label>
                    Main model
                    <select
                      value={draft.generatorSchemaName}
                      onChange={(event) => onDraftChange({ generatorSchemaName: event.target.value })}
                    >
                      <option value="">Auto: {availableModelNames[availableModelNames.length - 1]}</option>
                      {availableModelNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="mdt-inline-actions">
                  <button type="button" onClick={onGeneratePreview}>
                    Generate preview
                  </button>
                  <button type="button" onClick={onUseGeneratedResponse} disabled={!draft.generatorPreview}>
                    Use as manual response
                  </button>
                </div>
                {schemaWarnings.length > 0 ? (
                  <p className="mdt-warning" role="status">
                    {schemaWarnings.join(' ')}
                  </p>
                ) : null}
                {draft.generatorPreview ? (
                  <pre className="mdt-preview" data-testid="generated-response-preview">
                    {draft.generatorPreview}
                  </pre>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {editorTab === 'Manual Response' ? (
          <section className="mdt-section" aria-label="Manual response">
            <h3>Manual response</h3>
            <div className="mdt-form-grid">
              <label>
                Response header name
                <input
                  value={draft.responseHeaderName}
                  onChange={(event) => onDraftChange({ responseHeaderName: event.target.value })}
                />
              </label>
              <label>
                Response header value
                <input
                  value={draft.responseHeaderValue}
                  onChange={(event) => onDraftChange({ responseHeaderValue: event.target.value })}
                />
              </label>
            </div>
            <label>
              Manual response JSON
              <textarea
                value={draft.responseJson}
                onChange={(event) => onDraftChange({ responseJson: event.target.value })}
                placeholder='{"ok":true}'
              />
            </label>
          </section>
        ) : null}

        {error ? <p role="alert">{error}</p> : null}

        <div className="mdt-sticky-actions" aria-label="Route actions">
          {editingRouteId ? (
            <>
              <button type="button" onClick={onNewRoute}>
                New route
              </button>
              <button type="button" onClick={onSaveRoute}>
                Save changes
              </button>
            </>
          ) : (
            <button type="button" onClick={onSaveRoute}>
              Add route
            </button>
          )}
        </div>
      </form>

      <section className="mdt-section mdt-route-list" aria-label="Configured routes">
        <h3>Configured routes</h3>
        <div className="mdt-table-scroll">
          <table aria-label="Configured routes">
            <thead>
              <tr>
                <th>Enabled</th>
                <th>Method</th>
                <th>Pattern</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id}>
                  <td>
                    <input
                      aria-label={`Enable route ${route.method} ${route.urlPattern}`}
                      type="checkbox"
                      checked={route.enabled}
                      onChange={() => onToggleRoute(route.id)}
                    />
                  </td>
                  <td>{route.method}</td>
                  <td>{route.urlPattern}</td>
                  <td>{route.response.status}</td>
                  <td>
                    <div className="mdt-row-actions">
                      <button type="button" aria-label={`Edit ${route.method} ${route.urlPattern}`} onClick={() => onEditRoute(route)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Duplicate ${route.method} ${route.urlPattern}`}
                        onClick={() => onDuplicateRoute(route)}
                      >
                        Duplicate
                      </button>
                      <button type="button" onClick={() => onDeleteRoute(route.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function supportsRequestBody(method: MockRoute['method']): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH'
}
