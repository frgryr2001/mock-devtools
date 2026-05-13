import type { RequestLogEntry } from '@mock-devtools/browser-runtime'

interface LogsTabProps {
  logs: RequestLogEntry[]
  onClear(): void
}

export function LogsTab({ logs, onClear }: LogsTabProps) {
  return (
    <div className="mdt-stack">
      <button type="button" onClick={onClear}>
        Clear logs
      </button>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Method</th>
            <th>URL</th>
            <th>Mode</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatLogTime(log.timestamp)}</td>
              <td>{log.method}</td>
              <td>{log.url}</td>
              <td>{log.mocked ? 'mocked' : 'pass-through'}</td>
              <td>{log.status ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatLogTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}
