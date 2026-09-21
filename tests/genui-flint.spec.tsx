// @vitest-environment jsdom
// FlintNode: Flint input → ECharts option compilation, engine-bundle choice,
// compile/engine fallbacks, and streamed option updates; plus the flint repair
// path in the guard (sanitization, required fields, tooltip renderMode).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FlintNode } from '../src/client/FlintNode.tsx'
import { repairGenuiSpec, validateGenuiSpec } from '../src/client/guard.ts'
import { compileFlintToEcharts } from '../src/client/flint-lazy.ts'
import { createChart } from '../src/client/echarts-lazy.ts'
import { t } from '../src/client/i18n/index.ts'
import type { GenuiFlint } from '../src/client/spec.ts'

vi.mock('../src/client/flint-lazy.ts', () => ({ compileFlintToEcharts: vi.fn() }))
vi.mock('../src/client/echarts-lazy.ts', async () => {
  const actual = await vi.importActual<typeof import('../src/client/echarts-lazy.ts')>('../src/client/echarts-lazy.ts')
  return { createChart: vi.fn(), CORE_PRESETS: actual.CORE_PRESETS }
})

beforeEach(() => {
  vi.mocked(compileFlintToEcharts).mockReset()
  vi.mocked(createChart).mockReset()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function fakeInstance() {
  return { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
}

const flintNode = (input: GenuiFlint['input'], height?: number): GenuiFlint =>
  ({ type: 'flint', input, ...(height === undefined ? {} : { height }) })

const barInput: GenuiFlint['input'] = {
  data: { values: [{ month: '1月', sales: 128 }] },
  semantic_types: { month: 'Month', sales: 'Amount' },
  chart_spec: { chartType: 'Bar Chart', encodings: { x: { field: 'month' }, y: { field: 'sales' } } },
}

describe('FlintNode: engine selection', () => {
  it('renders core chart types through the core bundle with layout defaults', async () => {
    vi.mocked(compileFlintToEcharts).mockResolvedValue({ series: [{ type: 'bar', data: [128] }] })
    vi.mocked(createChart).mockResolvedValue(fakeInstance())
    render(<FlintNode node={flintNode(barInput)} />)
    await vi.waitFor(() => { expect(createChart).toHaveBeenCalled() })
    const [, option, opts, engine] = vi.mocked(createChart).mock.calls[0]!
    expect(engine).toBe('core')
    expect(opts).toEqual({ height: 300 })
    // Layout defaults are filled in without overwriting model/Flint values.
    expect(option).toMatchObject({ tooltip: { confine: true }, series: [{ type: 'bar', data: [128] }] })
    expect(document.querySelector('[data-genui-flint]')).toBeTruthy()
  })

  it('falls back to the full bundle for series the core build cannot draw', async () => {
    vi.mocked(compileFlintToEcharts).mockResolvedValue({ series: [{ type: 'sankey', data: [] }] })
    vi.mocked(createChart).mockResolvedValue(fakeInstance())
    render(<FlintNode node={flintNode(barInput)} />)
    await vi.waitFor(() => { expect(createChart).toHaveBeenCalled() })
    expect(vi.mocked(createChart).mock.calls[0]![3]).toBe('full')
  })

  it('honours an explicit height', async () => {
    vi.mocked(compileFlintToEcharts).mockResolvedValue({ series: [{ type: 'line' }] })
    vi.mocked(createChart).mockResolvedValue(fakeInstance())
    render(<FlintNode node={flintNode(barInput, 420)} />)
    await vi.waitFor(() => { expect(createChart).toHaveBeenCalled() })
    expect(vi.mocked(createChart).mock.calls[0]![2]).toEqual({ height: 420 })
  })
})

describe('FlintNode: fallbacks', () => {
  it('shows the compile fallback and never mounts the engine when Flint rejects the input', async () => {
    vi.mocked(compileFlintToEcharts).mockRejectedValue(new Error('bad chartType'))
    render(<FlintNode node={flintNode(barInput)} />)
    expect(await screen.findByText(t('block.flintError'))).toBeTruthy()
    expect(createChart).not.toHaveBeenCalled()
  })

  it('shows the compile fallback when the flint asset cannot be loaded', async () => {
    vi.mocked(compileFlintToEcharts).mockRejectedValue(new Error('asset missing'))
    render(<FlintNode node={flintNode({ ...barInput }) } />)
    expect(await screen.findByText(t('block.flintError'))).toBeTruthy()
  })

  it('disposes the engine instance when the block unmounts', async () => {
    const instance = fakeInstance()
    vi.mocked(compileFlintToEcharts).mockResolvedValue({ series: [{ type: 'bar' }] })
    vi.mocked(createChart).mockResolvedValue(instance)
    const view = render(<FlintNode node={flintNode(barInput)} />)
    await vi.waitFor(() => { expect(createChart).toHaveBeenCalled() })
    view.unmount()
    expect(instance.dispose).toHaveBeenCalled()
  })
})

describe('FlintNode: streamed updates', () => {
  it('re-applies a new option with replace semantics instead of remounting', async () => {
    const instance = fakeInstance()
    vi.mocked(compileFlintToEcharts).mockResolvedValue({ series: [{ type: 'bar', data: [1] }] })
    vi.mocked(createChart).mockResolvedValue(instance)
    const view = render(<FlintNode node={flintNode(barInput)} />)
    // The engine-ready effect re-applies the option once after mount.
    await vi.waitFor(() => { expect(instance.setOption).toHaveBeenCalled() })
    const afterMount = instance.setOption.mock.calls.length

    vi.mocked(compileFlintToEcharts).mockResolvedValue({ series: [{ type: 'bar', data: [1, 2] }] })
    view.rerender(<FlintNode node={flintNode({ ...barInput, options: { width: 400 } })} />)
    await vi.waitFor(() => { expect(instance.setOption.mock.calls.length).toBe(afterMount + 1) })
    const last = instance.setOption.mock.calls.at(-1)!
    expect(last[1]).toBe(true)
    expect(last[0]).toMatchObject({ series: [{ type: 'bar', data: [1, 2] }] })
    // A streamed update must not recreate the engine.
    expect(createChart).toHaveBeenCalledTimes(1)
  })
})

describe('repairGenuiSpec: flint', () => {
  it('keeps a valid flint node and clamps the height', () => {
    const spec = repairGenuiSpec({ items: [{ type: 'flint', input: barInput, height: 9999 }] })!
    expect(spec.items).toHaveLength(1)
    expect(spec.items[0]).toMatchObject({ type: 'flint', height: 800 })
  })

  it('drops a flint node without a chart_spec (or with a non-string chartType)', () => {
    const missing = repairGenuiSpec({ items: [{ type: 'flint', input: { data: { values: [] } } }] })!
    expect(missing.items).toHaveLength(0)
    const badType = repairGenuiSpec({ items: [{
      type: 'flint',
      input: { data: { values: [] }, chart_spec: { chartType: 42, encodings: {} } },
    }] })!
    expect(badType.items).toHaveLength(0)
  })

  it('sanitizes strings that would reach an ECharts tooltip or label', () => {
    const spec = repairGenuiSpec({ items: [{
      type: 'flint',
      input: {
        data: { values: [{ label: '<img src=x onerror=alert(1)>', value: 1 }] },
        semantic_types: { label: 'Category', value: 'Amount' },
        chart_spec: { chartType: 'Bar Chart', encodings: { x: { field: 'label' }, y: { field: 'value' } } },
      },
    }] })!
    const input = (spec.items[0] as { input: { data: { values: Array<Record<string, unknown>> } } }).input
    expect(JSON.stringify(input)).not.toContain('onerror')
    expect(JSON.stringify(input)).not.toContain('<img')
  })

  it('forces richText tooltips so ECharts never writes model strings through innerHTML', () => {
    const spec = repairGenuiSpec({ items: [{
      type: 'flint',
      input: {
        data: { values: [{ label: 'a', value: 1 }] },
        chart_spec: { chartType: 'Bar Chart', encodings: { x: { field: 'label' }, y: { field: 'value' } } },
        options: { tooltip: { trigger: 'axis', formatter: '{b}: {c}' } },
      },
    }] })!
    const input = (spec.items[0] as { input: { options: { tooltip: { renderMode: string } } } }).input
    expect(input.options.tooltip.renderMode).toBe('richText')
  })
})

describe('validateGenuiSpec: flint', () => {
  it('accepts a valid flint node instead of reporting an unknown type', () => {
    const result = validateGenuiSpec({ items: [{ type: 'flint', input: barInput }] })
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('reports the missing chart_spec rather than accepting an uncompilable node', () => {
    const result = validateGenuiSpec({ items: [{ type: 'flint', input: { data: { values: [] } } }] })
    expect(result.errors.join(' ')).toContain('input.chart_spec.chartType')
  })
})
