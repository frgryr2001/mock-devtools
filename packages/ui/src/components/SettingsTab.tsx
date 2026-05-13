interface SettingsTabProps {
  logPassThrough: boolean
  backendOrigin: string
  proxySyncUrl: string
  onLogPassThroughChange(logPassThrough: boolean): void
  onBackendOriginChange(backendOrigin: string): void
  onProxySyncUrlChange(proxySyncUrl: string): void
  onClearRoutes(): void
}

export function SettingsTab({
  logPassThrough,
  backendOrigin,
  proxySyncUrl,
  onLogPassThroughChange,
  onBackendOriginChange,
  onProxySyncUrlChange,
  onClearRoutes,
}: SettingsTabProps) {
  return (
    <div className="mdt-settings" role="group" aria-label="Settings controls">
      <label className="mdt-switch-row" aria-label="Log pass-through requests">
        <span>
          <strong>Log pass-through requests</strong>
          <small>Show requests that did not match a mock route.</small>
        </span>
        <input
          aria-label="Log pass-through requests"
          type="checkbox"
          checked={logPassThrough}
          onChange={(event) => onLogPassThroughChange(event.target.checked)}
        />
      </label>
      <label className="mdt-settings-field">
        <span>
          <strong>Backend origin override</strong>
          <small>Only match relative routes on this backend origin. Leave empty to match the current request URL.</small>
        </span>
        <input
          aria-label="Backend origin override"
          placeholder="https://api.example.test"
          value={backendOrigin}
          onChange={(event) => onBackendOriginChange(event.target.value)}
        />
      </label>
      <label className="mdt-settings-field">
        <span>
          <strong>Proxy sync URL</strong>
          <small>Send routes to a local proxy, for example http://localhost:5055/__mock-devtools/state.</small>
        </span>
        <input
          aria-label="Proxy sync URL"
          placeholder="http://localhost:5055/__mock-devtools/state"
          value={proxySyncUrl}
          onChange={(event) => onProxySyncUrlChange(event.target.value)}
        />
      </label>
      <div className="mdt-settings-action">
        <span>
          <strong>Routes</strong>
          <small>Remove every configured route from this browser.</small>
        </span>
        <button type="button" onClick={onClearRoutes}>
          Clear routes
        </button>
      </div>
    </div>
  )
}
