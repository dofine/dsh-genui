/**
 * ECharts / Flint chart renderers. Both render through the same lazy
 * echarts engine; the difference is the source of the `option`:
 * `EchartsNode` sets a model-authored option directly (host-themed with
 * default-only design tokens), while `FlintNode` compiles a Flint
 * `ChartAssemblyInput` to an option via the flint asset before handing it to
 * the engine. Both keep the deep-sanitized spec as the only input — no HTML,
 * no functions, no scripts — mirroring MermaidNode's fallback-UI posture
 * when an engine asset fails to load.
 * @module dsh-genui-charts/client/blocks/charts-extra
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import css from '../GenuiBlock.module.css'
import { GENUI_LIMITS } from '../guard.ts'
import { loadEcharts } from '../echarts-lazy.ts'
import { compileFlintToEcharts } from '../flint-lazy.ts'
import { CHART_COLORS } from './charts.tsx'
import type { GenuiEcharts, GenuiFlint } from '../spec.ts'

/** Cap the option height to the (guard-enforced) chart block ceiling. */
function cappedHeight(height: number | undefined): number {
  const h = Math.floor(height ?? GENUI_LIMITS.maxChartHeight)
  return Math.max(80, Math.min(GENUI_LIMITS.maxChartHeight, h))
}

/* ---------------- host-theme defaults ---------------- */

/** Fallback values for host design tokens when the CSS custom property is
 * absent (jsdom tests, hosts without the design system). */
const THEME_FALLBACKS = {
  accent: '#4f8ef7',
  labelPrimary: '#e6e6e6',
  labelSecondary: '#a0a0a0',
  border: 'rgba(255,255,255,0.12)',
  bgLayer1: '#1a1a1e',
} as const

/** Read a CSS custom property from the document root (host theme token). */
function readToken(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * Host-theme defaults for a model-authored ECharts option: resolve
 * design-system tokens — the chart palette (CSS vars do not resolve
 * inside an ECharts canvas, so they become hard colors), label colors, and the
 * tooltip surface — and inject ONLY missing fields, so an explicit model value
 * always wins. A raw option would otherwise render with ECharts' light-theme
 * defaults on the host's dark surface.
 */
export function withHostTheme(option: Record<string, unknown>): Record<string, unknown> {
  const bg = readToken('--dsw-alias-bg-layer-1', THEME_FALLBACKS.bgLayer1)
  const tl = {
    accent: readToken('--dsw-alias-state-business-primary', THEME_FALLBACKS.accent),
    labelPrimary: readToken('--dsw-alias-label-primary', THEME_FALLBACKS.labelPrimary),
    labelSecondary: readToken('--dsw-alias-label-secondary', THEME_FALLBACKS.labelSecondary),
    border: readToken('--dsw-alias-border-l1', THEME_FALLBACKS.border),
  }
  let out = option
  if (!Array.isArray(out.color)) {
    out = { ...out, color: CHART_COLORS.map(c => readToken(c.replace('var(', '').replace(')', ''), tl.accent)) }
  }
  if (out.backgroundColor === undefined) out = { ...out, backgroundColor: 'transparent' }
  const textStyle = isPlainObject(out.textStyle) ? out.textStyle : undefined
  if (textStyle === undefined || textStyle.color === undefined || textStyle.fontFamily === undefined) {
    out = {
      ...out,
      textStyle: {
        ...(textStyle ?? {}),
        ...(textStyle?.color !== undefined ? {} : { color: tl.labelSecondary }),
        ...(textStyle?.fontFamily !== undefined ? {} : { fontFamily: 'inherit' }),
      },
    }
  }
  const tooltip = out.tooltip
  if (isPlainObject(tooltip)) {
    const themed: Record<string, unknown> = { ...tooltip }
    if (themed.backgroundColor === undefined) themed.backgroundColor = bg
    if (themed.borderColor === undefined) themed.borderColor = tl.border
    const ttStyle = isPlainObject(themed.textStyle) ? themed.textStyle : undefined
    if (ttStyle === undefined || ttStyle.color === undefined) {
      themed.textStyle = { ...(ttStyle ?? {}), color: tl.labelPrimary }
    }
    out = { ...out, tooltip: themed }
  }
  return out
}

/**
 * Ensure the option's `tooltip` is confined to the chart container: ECharts
 * defaults `confine: false`, so the tooltip can overflow past the block (and
 * past the viewport) at the margins. Set `confine: true` when the model (or
 * Flint) did not already choose a value, leaving every other tooltip field
 * untouched.
 */
export function withConfinedTooltip(option: Record<string, unknown>): Record<string, unknown> {
  const tooltip = option.tooltip
  if (tooltip !== null && typeof tooltip === 'object' && !Array.isArray(tooltip) && 'confine' in tooltip) {
    return option
  }
  const mergedTooltip = tooltip !== null && typeof tooltip === 'object' && !Array.isArray(tooltip)
    ? { ...tooltip, confine: true }
    : { confine: true }
  return { ...option, tooltip: mergedTooltip }
}

/** Is `v` a plain object (not array, not null)? */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Default `grid.containLabel: true` so axis labels are always inside the
 * grid margins instead of overlapping the plot or clipping at the block
 * edge. Only fills the default — an explicit `containLabel` (true or false)
 * from the model or Flint wins.
 */
export function withContainLabel(option: Record<string, unknown>): Record<string, unknown> {
  const grid = option.grid
  if (grid === undefined) return { ...option, grid: { containLabel: true } }
  if (isPlainObject(grid)) {
    return 'containLabel' in grid ? option : { ...option, grid: { ...grid, containLabel: true } }
  }
  if (Array.isArray(grid)) {
    return {
      ...option,
      grid: grid.map(g => (isPlainObject(g) && !('containLabel' in g) ? { ...g, containLabel: true } : g)),
    }
  }
  return option
}

/**
 * Default `axisLabel.interval: 'auto'` on category axes so a narrow
 * container thins the tick labels instead of overlapping them. Explicit
 * `interval` values from the model or Flint are left untouched.
 */
export function withAutoLabelInterval(option: Record<string, unknown>): Record<string, unknown> {
  const patchAxis = (axis: unknown): unknown => {
    if (!isPlainObject(axis) || axis.type !== 'category') return axis
    if (isPlainObject(axis.axisLabel) && 'interval' in axis.axisLabel) return axis
    return { ...axis, axisLabel: { ...(isPlainObject(axis.axisLabel) ? axis.axisLabel : {}), interval: 'auto' } }
  }
  const out: Record<string, unknown> = { ...option }
  for (const key of ['xAxis', 'yAxis'] as const) {
    const axis = option[key]
    out[key] = Array.isArray(axis) ? axis.map(patchAxis) : patchAxis(axis)
  }
  return out
}

/**
 * Compact pie layout for narrow containers (< 360px): Flint emits fixed-px
 * radii (e.g. `["36px","80px"]`) and outside labels tuned for its ~400px
 * base size, which overflow and overlap when a grid column squeezes the
 * chart. Take over only the layout fields then — percentage radii, inside
 * labels, no leader lines.
 */
export function withCompactPie(option: Record<string, unknown>): Record<string, unknown> {
  const series = option.series
  if (!Array.isArray(series)) return option
  const out = series.map(s => {
    if (!isPlainObject(s) || s.type !== 'pie') return s
    return {
      ...s,
      radius: ['20%', '40%'],
      label: { ...(isPlainObject(s.label) ? s.label : {}), position: 'inside' },
      labelLine: { show: false },
      labelLayout: { hideOverlap: false },
    }
  })
  return { ...option, series: out }
}

/**
 * Container-aware option defaults: confined tooltip, label-containing grid,
 * auto-thinned category ticks, and a compact pie layout when the block is
 * narrow. Every field is default-only — explicit values always win.
 */
export function adaptChartOption(option: Record<string, unknown>, containerWidth: number): Record<string, unknown> {
  let out = withConfinedTooltip(option)
  out = withContainLabel(out)
  out = withAutoLabelInterval(out)
  if (containerWidth > 0 && containerWidth < 360) out = withCompactPie(out)
  return out
}

/**
 * Mount an echarts instance onto a div and drive it with `option`. Returns
 * the DOM node the effect lifecycle owns (echarts init/resize/dispose).
 *
 * Two effects split the lifecycle: a mount effect lazily loads the engine
 * and initializes the chart with the CURRENT option (read through
 * `optionRef`, so an option that lands while the engine loads is never
 * applied stale), and owns resize + dispose; an update effect re-applies
 * `setOption` whenever the option object changes or the engine transitions
 * loading → ready, so streamed spec updates reach the canvas. `notMerge`
 * replace semantics keep the chart on the latest model output instead of
 * accumulating stale series.
 */
function useEchartsChart(option: Record<string, unknown> | null): {
  ref: React.RefObject<HTMLDivElement>
  failed: boolean
} {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const optionRef = useRef(option)
  optionRef.current = option
  const chartRef = useRef<{ setOption: (o: Record<string, unknown>, notMerge?: boolean) => void; resize: () => void; dispose: () => void } | null>(null)

  // Mount: create the chart; cleanup disposes. A height-only change never
  // recreates the engine — the inline height style change is tracked by the
  // ResizeObserver below.
  useEffect(() => {
    const dom = ref.current
    if (dom === null) return
    let disposed = false
    void loadEcharts().then(({ init }) => {
      if (disposed) return
      const chart = init(dom)
      chart.setOption(adaptChartOption(optionRef.current ?? {}, dom.clientWidth))
      chartRef.current = chart
      setReady(true)
    }).catch(() => {
      if (!disposed) setFailed(true)
    })
    // Resize on window change keeps the canvas tracking its container.
    const onResize = (): void => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    // ResizeObserver additionally tracks the container itself: a grid column
    // or panel resize moves the block without a window resize.
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => chartRef.current?.resize())
      observer.observe(dom)
    }
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [option === null])

  // Update: re-apply the latest option on every change (streaming re-renders)
  // and when the engine becomes ready, so an option that arrived during
  // engine load is applied instead of lost.
  useEffect(() => {
    if (!ready || option === null) return
    const dom = ref.current
    const chart = chartRef.current
    if (dom === null || chart === null) return
    chart.setOption(adaptChartOption(option, dom.clientWidth), true)
  }, [option, ready])

  return { ref, failed }
}

/** Raw ECharts node: host-theme the model-authored (sanitized) option with
 * default-only tokens, then set it directly. */
export function EchartsNode({ node }: { node: GenuiEcharts }) {
  const height = cappedHeight(node.height)
  const option = useMemo(() => withHostTheme(node.option), [node.option])
  const { ref, failed } = useEchartsChart(option)
  if (failed) {
    return (
      <div className={css.mermaidFallback}>
        <pre>{JSON.stringify(node.option, null, 2)}</pre>
        <div className={css.mermaidErr}>图表引擎加载失败，已降级显示配置</div>
      </div>
    )
  }
  return <div ref={ref} className={css.echartsBox} style={{ height }} data-genui-echarts />
}

/** Flint node: compile the assembly input to an ECharts option, then render. */
export function FlintNode({ node }: { node: GenuiFlint }) {
  const height = cappedHeight(node.height)
  const [option, setOption] = useState<Record<string, unknown> | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    void compileFlintToEcharts(node.input).then(op => {
      if (alive) setOption(op)
    }).catch(() => {
      if (alive) setFailed(true)
    })
    return () => { alive = false }
  }, [node.input])
  if (failed) {
    return (
      <div className={css.mermaidFallback}>
        <pre>{JSON.stringify(node.input, null, 2)}</pre>
        <div className={css.mermaidErr}>Flint 编译失败，已降级显示规格</div>
      </div>
    )
  }
  if (option === null) {
    return (
      <div className={css.mermaidFallback}>
        <pre>{JSON.stringify(node.input, null, 2)}</pre>
        <div className={css.mermaidHint}>编译中…</div>
      </div>
    )
  }
  return <FlintRendered option={option} height={height} />
}

/** Inner renderer so the echarts mount effect keys on the resolved option. */
function FlintRendered({ option, height }: { option: Record<string, unknown>; height: number }) {
  const { ref, failed } = useEchartsChart(option)
  if (failed) {
    return (
      <div className={css.mermaidFallback}>
        <pre>{JSON.stringify(option, null, 2)}</pre>
        <div className={css.mermaidErr}>图表引擎加载失败，已降级显示配置</div>
      </div>
    )
  }
  return <div ref={ref} className={css.echartsBox} style={{ height }} data-genui-echarts />
}
