import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  cleanup()
  localStorage.clear()
})

describe('App', () => {
  it('renders the trigger closed by default and opens the panel on click', async () => {
    render(<App storageKey="test-closed" />)

    expect(screen.queryByRole('dialog', { name: 'Mock DevTools' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open Mock DevTools' }))
    expect(screen.getByRole('dialog', { name: 'Mock DevTools' })).toBeInTheDocument()
  })

  it('keeps the panel mounted while the close animation runs', () => {
    vi.useFakeTimers()
    render(<App defaultOpen storageKey="test-animated-close" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Mock DevTools' }))

    expect(screen.getByRole('dialog', { name: 'Mock DevTools' })).toHaveClass('mdt-panel-closing')

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(screen.queryByRole('dialog', { name: 'Mock DevTools' })).not.toBeInTheDocument()
  })

  it('adds a route with method and URL pattern', async () => {
    render(<App defaultOpen storageKey="test-add-route" />)

    await userEvent.selectOptions(screen.getByLabelText('Method'), 'POST')
    await userEvent.clear(screen.getByLabelText('URL pattern'))
    await userEvent.type(screen.getByLabelText('URL pattern'), '/api/users')
    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))

    expect(within(screen.getByRole('table')).getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('/api/users')).toBeInTheDocument()
  })

  it('adds a route with request header and response configuration', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-route-config" onStateChange={onStateChange} />)

    await userEvent.clear(screen.getByLabelText('URL pattern'))
    await userEvent.type(screen.getByLabelText('URL pattern'), '/api/users/:id')
    await userEvent.type(screen.getByLabelText('Header name'), 'x-tenant')
    await userEvent.selectOptions(screen.getByLabelText('Header operator'), 'equals')
    await userEvent.type(screen.getByLabelText('Header value'), 'acme')
    await userEvent.clear(screen.getByLabelText('Delay ms'))
    await userEvent.type(screen.getByLabelText('Delay ms'), '150')
    await userEvent.clear(screen.getByLabelText('Status'))
    await userEvent.type(screen.getByLabelText('Status'), '201')
    await userEvent.click(screen.getByRole('button', { name: 'Custom Response' }))
    await userEvent.selectOptions(screen.getByLabelText('Response shape'), 'object')
    await userEvent.click(screen.getByRole('button', { name: 'Manual Response' }))
    await userEvent.type(screen.getByLabelText('Response header name'), 'x-mock')
    await userEvent.type(screen.getByLabelText('Response header value'), 'yes')
    fireEvent.change(screen.getByLabelText('Manual response JSON'), { target: { value: '{"ok":true}' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({
            delayMs: 150,
            requestHeaders: [{ name: 'x-tenant', operator: 'equals', value: 'acme' }],
            response: expect.objectContaining({
              status: 201,
              headers: { 'x-mock': 'yes' },
              body: { ok: true },
            }),
          }),
        ],
      }),
    )
  })

  it('generates route response JSON from a TypeScript interface', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-route-generator" onStateChange={onStateChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Custom Response' }))
    await userEvent.selectOptions(screen.getByLabelText('Response shape'), 'array')
    await userEvent.clear(screen.getByLabelText('Item count'))
    await userEvent.type(screen.getByLabelText('Item count'), '3')
    fireEvent.change(screen.getByLabelText('TypeScript response model'), {
      target: {
        value: `interface User {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
}`,
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Generate preview' }))

    expect(screen.getByTestId('generated-response-preview')).toHaveTextContent('"email"')

    await userEvent.click(screen.getByRole('button', { name: 'Use as manual response' }))
    expect((screen.getByLabelText('Manual response JSON') as HTMLTextAreaElement).value).toContain('"email"')
    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({
            response: expect.objectContaining({
              shape: 'array',
              itemCount: 3,
              body: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                  name: expect.any(String),
                  email: expect.stringContaining('@'),
                  status: expect.stringMatching(/active|inactive/),
                }),
              ]),
            }),
          }),
        ],
      }),
    )
  })

  it('selects the main model from TypeScript classes before generating a response', async () => {
    render(<App defaultOpen storageKey="test-class-generator" />)

    await userEvent.click(screen.getByRole('button', { name: 'Custom Response' }))
    fireEvent.change(screen.getByLabelText('TypeScript response model'), {
      target: {
        value: `import { User360Model } from "@icondo/models/class";
import { isObject } from "lodash";

export class CompanyModel {
  fullName: string;
  shortName: string;
  attachments: {
    url: string;
    name: string;
  }[];
}

export class PartnerModel extends User360Model {
  company: CompanyModel;
  _companyName: string;
  shortName?: string;
  profile?: {
    jobTitle: string;
    officeNumber: string;
    officeNumberE164: string;
  };

  constructor(data?: Partial<PartnerModel>) {
    super();
    if (isObject(data)) {
      Object.assign(this, data);
    }
  }
}`,
      },
    })
    await userEvent.selectOptions(screen.getByLabelText('Main model'), 'PartnerModel')
    await userEvent.click(screen.getByRole('button', { name: 'Generate preview' }))

    expect(screen.getByTestId('generated-response-preview')).toHaveTextContent('"company"')
    expect(screen.getByTestId('generated-response-preview')).toHaveTextContent('"fullName"')
    expect(screen.getByTestId('generated-response-preview')).toHaveTextContent('"profile"')
    expect(screen.getByTestId('generated-response-preview')).not.toHaveTextContent('"constructor"')
  })

  it('uses the adapter schema resolver when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema: {
          name: 'PartnerModel',
          fields: [
            { name: 'id', optional: false, kind: 'string' },
            { name: 'companyName', optional: false, kind: 'string' },
          ],
        },
        unresolvedImports: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    globalThis.fetch = fetchMock as unknown as typeof fetch
    window.fetch = fetchMock
    render(<App defaultOpen storageKey="test-adapter-schema" schemaResolverUrl="/@mock-devtools/schema" />)

    await userEvent.click(screen.getByRole('button', { name: 'Custom Response' }))
    fireEvent.change(screen.getByLabelText('TypeScript response model'), {
      target: { value: 'export class PartnerModel extends User360Model { companyName: string }' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Generate preview' }))

    await waitFor(() => expect(screen.getByTestId('generated-response-preview')).toHaveTextContent('"companyName"'))
  })

  it('warns and falls back to local model fields when adapter imports are unresolved', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema: {
          name: 'PartnerModel',
          fields: [{ name: 'companyName', optional: false, kind: 'string' }],
        },
        unresolvedImports: [{ name: 'User360Model', specifier: '@/models/User360Model' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    globalThis.fetch = fetchMock as unknown as typeof fetch
    window.fetch = fetchMock
    render(<App defaultOpen storageKey="test-unresolved-import-warning" schemaResolverUrl="/@mock-devtools/schema" />)

    await userEvent.click(screen.getByRole('button', { name: 'Custom Response' }))
    fireEvent.change(screen.getByLabelText('TypeScript response model'), {
      target: {
        value: `import { User360Model } from "@/models/User360Model";

export class PartnerModel extends User360Model {
  companyName: string;
}`,
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Generate preview' }))

    await waitFor(() => expect(screen.getByTestId('generated-response-preview')).toHaveTextContent('"companyName"'))
    expect(screen.getByRole('status')).toHaveTextContent('Unresolved imports: User360Model from "@/models/User360Model"')
    expect(screen.getByTestId('generated-response-preview')).not.toHaveTextContent('"id"')
  })

  it('saves manual response JSON when generator settings are also configured', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-manual-response-wins" onStateChange={onStateChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Custom Response' }))
    await userEvent.selectOptions(screen.getByLabelText('Response shape'), 'array')
    await userEvent.clear(screen.getByLabelText('Item count'))
    await userEvent.type(screen.getByLabelText('Item count'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Manual Response' }))
    fireEvent.change(screen.getByLabelText('Manual response JSON'), { target: { value: '{"source":"manual"}' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({
            response: expect.objectContaining({
              shape: 'array',
              itemCount: 5,
              body: { source: 'manual' },
            }),
          }),
        ],
      }),
    )
  })

  it('shows body matcher for POST routes and hides it for GET routes', async () => {
    render(<App defaultOpen storageKey="test-body-visibility" />)

    expect(screen.queryByLabelText('Body match operator')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Method'), 'POST')

    expect(screen.getByLabelText('Body match operator')).toBeInTheDocument()
    expect(screen.getByLabelText('Body JSON')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Method'), 'GET')

    expect(screen.queryByLabelText('Body match operator')).not.toBeInTheDocument()
  })

  it('saves JSON body contains matcher for POST routes', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-body-save" onStateChange={onStateChange} />)

    await userEvent.selectOptions(screen.getByLabelText('Method'), 'POST')
    await userEvent.clear(screen.getByLabelText('URL pattern'))
    await userEvent.type(screen.getByLabelText('URL pattern'), '/api/users')
    await userEvent.selectOptions(screen.getByLabelText('Body match operator'), 'contains')
    fireEvent.change(screen.getByLabelText('Body JSON'), { target: { value: '{"role":"admin"}' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({
            requestBody: { operator: 'contains', json: { role: 'admin' } },
          }),
        ],
      }),
    )
  })

  it('edits an existing route instead of adding a duplicate', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-edit-route" onStateChange={onStateChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit GET /api/example' }))
    await userEvent.clear(screen.getByLabelText('URL pattern'))
    await userEvent.type(screen.getByLabelText('URL pattern'), '/api/edited')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        routes: [
          expect.objectContaining({
            urlPattern: '/api/edited',
          }),
        ],
      }),
    )
    expect(onStateChange.mock.lastCall?.[0].routes).toHaveLength(1)
  })

  it('keeps route actions available in a sticky footer', () => {
    render(<App defaultOpen storageKey="test-route-layout" />)

    expect(screen.getByRole('form', { name: 'Route builder' })).toBeInTheDocument()
    expect(screen.getByLabelText('Route actions')).toHaveClass('mdt-sticky-actions')
    expect(screen.getByRole('table', { name: 'Configured routes' })).toBeInTheDocument()
  })

  it('renders the tokenized route workspace structure', () => {
    render(<App defaultOpen storageKey="test-tokenized-layout" />)

    expect(screen.getByRole('dialog', { name: 'Mock DevTools' })).toHaveClass('mdt-panel-shell')
    expect(screen.getByRole('button', { name: 'Mocking off' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Route builder' })).toHaveClass('mdt-utility-card')
    expect(screen.getByLabelText('Route summary')).toHaveClass('mdt-summary-band')
  })

  it('toggles mocking from the panel header', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-header-toggle" onStateChange={onStateChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Mocking off' }))

    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }))
    expect(screen.getByRole('button', { name: 'Mocking on' })).toBeInTheDocument()
  })

  it('keeps only workflow tabs in the top navigation', () => {
    render(<App defaultOpen storageKey="test-top-tabs" />)

    expect(screen.getByRole('tab', { name: 'Routes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Schema' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Preview' })).not.toBeInTheDocument()
  })

  it('toggles a route', async () => {
    render(<App defaultOpen storageKey="test-toggle" />)

    await userEvent.click(screen.getByRole('button', { name: 'Add route' }))
    const checkbox = screen.getByRole('checkbox', { name: 'Enable route GET /api/example' })
    await userEvent.click(checkbox)

    expect(checkbox).not.toBeChecked()
  })

  it('renders mocked and pass-through log entries', async () => {
    render(
      <App
        defaultOpen
        storageKey="test-logs"
        initialLogs={[
          {
            id: '1',
            timestamp: Date.UTC(2026, 0, 2, 3, 4, 5),
            method: 'GET',
            url: '/api/users',
            mocked: true,
            routeId: 'users',
            status: 200,
            durationMs: 1,
          },
          {
            id: '2',
            timestamp: 0,
            method: 'GET',
            url: '/api/native',
            mocked: false,
            status: 204,
            durationMs: 2,
          },
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Logs' }))

    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/)).toHaveLength(2)
    expect(screen.getByText('mocked')).toBeInTheDocument()
    expect(screen.getByText('pass-through')).toBeInTheDocument()
  })

  it('persists settings through onStateChange', async () => {
    const onStateChange = vi.fn()
    render(<App defaultOpen storageKey="test-settings" onStateChange={onStateChange} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByLabelText('Settings controls')).toBeInTheDocument()
    expect(screen.getByText('Log pass-through requests').closest('label')).toHaveClass('mdt-switch-row')
    await userEvent.type(screen.getByLabelText('Backend origin override'), 'https://api.example.test')
    await userEvent.type(screen.getByLabelText('Proxy sync URL'), 'http://localhost:5055/__mock-devtools/state')
    await userEvent.click(screen.getByRole('button', { name: 'Mocking off' }))

    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        backendOrigin: 'https://api.example.test',
        proxySyncUrl: 'http://localhost:5055/__mock-devtools/state',
      }),
    )
  })
})
