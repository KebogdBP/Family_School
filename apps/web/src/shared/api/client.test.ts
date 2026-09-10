import { api } from './client'

describe('API client', () => {
  it('sends JSON with the session cookie enabled', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }),
      )
    await api('/example', { method: 'POST', body: JSON.stringify({ value: 1 }) })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/example')
    expect(init?.credentials).toBe('include')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('preserves a server error code and message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'wrong_grade', message: 'Этот маршрут предназначен для 4 класса' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await expect(api('/example')).rejects.toMatchObject({
      status: 409,
      code: 'wrong_grade',
      message: 'Этот маршрут предназначен для 4 класса',
    })
  })

  it('uses a safe fallback when an error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad gateway', { status: 502 }))
    await expect(api('/example')).rejects.toEqual(
      expect.objectContaining({ status: 502, code: 'request_failed', message: 'Не удалось выполнить запрос' }),
    )
  })
})
