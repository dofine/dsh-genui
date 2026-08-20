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
function withConfinedTooltip(option: Record<string, unknown>): Record<string, unknown> {
  const tooltip = option.tooltip
  if (tooltip !== null && typeof tooltip === 'object' && !Array.isArray(tooltip) && 'confine' in tooltip) {
    return option
  }
  const mergedTooltip = tooltip !== null && typeof tooltip === 'object' && !Array.isArray(tooltip)
    ? { ...tooltip, confine: true }
    : { confine: true }
  return { ...option, tooltip: mergedTooltip }
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
      chart.setOption(withConfinedTooltip(optionRef.current ?? {}))
    }).catch(() => {
      if (!disposed) setFailed(true)
    })
    // Resize on window change keeps the canvas tracking its container.
    const onResize = (): void => chart?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
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
