import { resolveAuthSetup, toAuthMode } from './authMode'

describe('toAuthMode', () => {
  it('keeps the two known modes', () => {
    expect(toAuthMode('personal')).toBe('personal')
    expect(toAuthMode('shared')).toBe('shared')
  })

  it.each([undefined, null, '', 'Shared', 'service', 1, true, {}])('reads %p as personal keys', (value) => {
    expect(toAuthMode(value)).toBe('personal')
  })
})

describe('resolveAuthSetup', () => {
  it('is personal keys for a config saved before the option existed', () => {
    expect(resolveAuthSetup({})).toEqual({ mode: 'personal' })
  })

  it.each([undefined, null])('is personal keys when there is no config (%p)', (config) => {
    expect(resolveAuthSetup(config)).toEqual({ mode: 'personal' })
  })

  it('is personal keys when asked for, whatever else the config holds', () => {
    expect(resolveAuthSetup({ authMode: 'personal', sharedApiKey: 'left-over-key' })).toEqual({ mode: 'personal' })
  })

  it('never exposes a key left over from the shared mode once back to personal keys', () => {
    expect(JSON.stringify(resolveAuthSetup({ authMode: 'personal', sharedApiKey: 'left-over-key' }))).not.toContain('left-over-key')
  })

  it('carries the shared key in shared mode', () => {
    expect(resolveAuthSetup({ authMode: 'shared', sharedApiKey: 'service-key' })).toEqual({ mode: 'shared', apiKey: 'service-key' })
  })

  it('trims the whitespace a copy-paste leaves around the key', () => {
    expect(resolveAuthSetup({ authMode: 'shared', sharedApiKey: '  service-key\n' })).toEqual({ mode: 'shared', apiKey: 'service-key' })
  })

  it.each([undefined, null, '', '   ', 42, {}])('has an empty key in shared mode when the stored key is %p', (sharedApiKey) => {
    expect(resolveAuthSetup({ authMode: 'shared', sharedApiKey })).toEqual({ mode: 'shared', apiKey: '' })
  })
})
