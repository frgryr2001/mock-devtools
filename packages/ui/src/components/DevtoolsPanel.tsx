import type { ReactNode } from 'react'

interface DevtoolsPanelProps {
  activeTab: string
  mockingEnabled: boolean
  animationState?: 'open' | 'closing'
  onTabChange(tab: string): void
  onMockingEnabledChange(enabled: boolean): void
  children: ReactNode
}

const tabs = ['Routes', 'Logs', 'Settings']

export function DevtoolsPanel({
  activeTab,
  mockingEnabled,
  animationState = 'open',
  onTabChange,
  onMockingEnabledChange,
  children,
}: DevtoolsPanelProps) {
  return (
    <section className={`mdt-panel mdt-panel-shell mdt-panel-${animationState}`} role="dialog" aria-label="Mock DevTools">
      <div className="mdt-panel-header">
        <div>
          <p className="mdt-panel-kicker">Mock DevTools</p>
          <h2>Route studio</h2>
        </div>
        <button
          className={`mdt-header-toggle ${mockingEnabled ? 'mdt-header-toggle-on' : 'mdt-header-toggle-off'}`}
          type="button"
          aria-pressed={mockingEnabled}
          onClick={() => onMockingEnabledChange(!mockingEnabled)}
        >
          {mockingEnabled ? 'Mocking on' : 'Mocking off'}
        </button>
      </div>
      <div className="mdt-tabs" role="tablist" aria-label="Mock DevTools tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mdt-content">{children}</div>
    </section>
  )
}
