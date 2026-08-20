/**
 * ECharts / Flint chart renderers. Both render through the same lazy
 * echarts engine; the difference is the source of the `option`:
 * `EchartsNode` sets a model-authored option directly, while `FlintNode`
 * compiles a Flint `ChartAssemblyInput` to an option via the flint asset
 * before handing it to the engine. Both keep the deep-sanitized spec as the
 * only input — no HTML, no functions, no scripts — mirroring MermaidNode's
 * fallback-UI posture when an engine asset fails to load.
 * @module dsh-genui-charts/client/blocks/charts-extra
 */
import { useEffect, useRef, useState } from 'react'
import css from '../GenuiBlock.module.css'
import { GENUI_LIMITS } from '../guard.ts'
import { loadEcharts } from '../echarts-lazy.ts'
import { compileFlintToEcharts } from '../flint-lazy.ts'
import type { GenuiEcharts, GenuiFlint } from '../spec.ts'

/** Cap the option height to the (guard-enforced) chart block ceiling. */
function cappedHeight(height: number | undefined): number {
  const h = Math.floor(height ?? GENUI_LIMITS.maxChartHeight)
  return Math.max(80, Math.min(GENUI_LIMITS.maxChartHeight, h))
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
 */
function useEchartsChart(option: Record<string, unknown> | null, height: number): {
  ref: React.RefObject<HTMLDivElement>
  failed: boolean
} {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const optionRef = useRef(option)
  optionRef.current = option
  useEffect(() => {
    const dom = ref.current
    if (dom === null || option === null) return
    let chart: { setOption: (o: Record<string, unknown>) => void; resize: () => void; dispose: () => void } | undefined
    let disposed = false
    void loadEcharts().then(({ init }) => {
      if (disposed) return
      chart = init(dom)
      chart.setOption(adaptChartOption(optionRef.current ?? {}, dom.clientWidth))
    }).catch(() => {
      if (!disposed) setFailed(true)
    })
    // Resize on window change keeps the canvas tracking its container.
    const onResize = (): void => chart?.resize()
    window.addEventListener('resize', onResize)
    // ResizeObserver additionally tracks the container itself: a grid column
    // or panel resize moves the block without a window resize.
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => chart?.resize())
      observer.observe(dom)
    }
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      chart?.dispose()
    }
  }, [option === null, height])
  return { ref, failed }
}

/** Raw ECharts node: set the model-authored (sanitized) option directly. */
export function EchartsNode({ node }: { node: GenuiEcharts }) {
  const height = cappedHeight(node.height)
  const { ref, failed } = useEchartsChart(node.option, height)
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
  const { ref, failed } = useEchartsChart(option, height)
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
