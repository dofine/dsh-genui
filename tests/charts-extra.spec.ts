/**
 * Container-aware option adaptation for echarts/flint charts: the default-only
 * injections that keep charts legible in narrow blocks (label-containing grid,
 * auto-thinned category ticks, compact pie layout) and the confined tooltip.
 * @module dsh-genui-charts/client/blocks/charts-extra.spec
 */
import { describe, expect, it } from 'vitest'
import {
  adaptChartOption,
  withAutoLabelInterval,
  withCompactPie,
  withConfinedTooltip,
  withContainLabel,
} from '../src/client/blocks/charts-extra.tsx'

describe('withConfinedTooltip', () => {
  it('injects confine:true when tooltip has no confine', () => {
    expect(withConfinedTooltip({ series: [] }).tooltip).toEqual({ confine: true })
    expect(withConfinedTooltip({ tooltip: { trigger: 'axis' } }).tooltip).toEqual({ trigger: 'axis', confine: true })
  })

  it('keeps an explicit confine value', () => {
    expect(withConfinedTooltip({ tooltip: { confine: false } }).tooltip).toEqual({ confine: false })
  })
})

describe('withContainLabel', () => {
  it('injects a containLabel grid when grid is absent', () => {
    expect(withContainLabel({}).grid).toEqual({ containLabel: true })
  })

  it('fills only the missing default on an object or array grid', () => {
    const single = withContainLabel({ grid: { left: 10 } })
    expect(single.grid).toEqual({ left: 10, containLabel: true })
    const many = withContainLabel({ grid: [{ left: 10 }, { containLabel: false }] })
    expect(many.grid).toEqual([{ left: 10, containLabel: true }, { containLabel: false }])
  })

  it('keeps an explicit containLabel', () => {
    expect(withContainLabel({ grid: { containLabel: false } }).grid).toEqual({ containLabel: false })
  })
})

describe('withAutoLabelInterval', () => {
  it('injects interval auto on category axes', () => {
    const out = withAutoLabelInterval({ xAxis: { type: 'category', data: ['a', 'b'] } })
    expect(out.xAxis).toEqual({ type: 'category', data: ['a', 'b'], axisLabel: { interval: 'auto' } })
  })

  it('keeps explicit intervals and leaves value axes untouched', () => {
    const out = withAutoLabelInterval({
      xAxis: { type: 'category', axisLabel: { interval: 0 } },
      yAxis: { type: 'value' },
    })
    expect(out.xAxis).toEqual({ type: 'category', axisLabel: { interval: 0 } })
    expect(out.yAxis).toEqual({ type: 'value' })
  })
})

describe('withCompactPie', () => {
  it('replaces px radii with percentage radii and moves labels inside', () => {
    const out = withCompactPie({
      series: [{ type: 'pie', radius: ['36px', '80px'], label: { formatter: '{d}%' } }],
    })
    const pie = (out.series as Array<Record<string, unknown>>)[0]!
    expect(pie.radius).toEqual(['20%', '40%'])
    expect(pie.label).toEqual({ formatter: '{d}%', position: 'inside' })
    expect(pie.labelLine).toEqual({ show: false })
  })

  it('leaves non-pie series untouched', () => {
    const out = withCompactPie({ series: [{ type: 'bar' }] })
    expect(out.series).toEqual([{ type: 'bar' }])
  })
})

describe('adaptChartOption', () => {
  it('applies the compact pie layout only for narrow containers', () => {
    const option = { series: [{ type: 'pie', radius: ['36px', '80px'] }] }
    const narrow = adaptChartOption(option, 300)
    expect((narrow.series as Array<Record<string, unknown>>)[0]!.radius).toEqual(['20%', '40%'])
    const wide = adaptChartOption(option, 800)
    expect((wide.series as Array<Record<string, unknown>>)[0]!.radius).toEqual(['36px', '80px'])
  })

  it('composes the full default set', () => {
    const out = adaptChartOption(
      { xAxis: { type: 'category', data: ['a'] }, series: [] },
      500,
    )
    expect(out.tooltip).toEqual({ confine: true })
    expect(out.grid).toEqual({ containLabel: true })
    expect((out.xAxis as Record<string, unknown>).axisLabel).toEqual({ interval: 'auto' })
  })
})
