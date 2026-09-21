/**
 * Flint chart node: compiles a declarative Flint `ChartAssemblyInput` into an
 * ECharts option (via the lazily loaded `lib/assets/flint.js` assembler) and
 * renders it through the same lazy echarts engine the `echart` node uses. The
 * semantic-types contract (Amount / Percentage / Month / Category …) drives
 * zero-baseline, axis formatting and percentage labels, so the model writes
 * data and semantics instead of a full option.
 *
 * Both engine assets load on demand: a conversation that never contains a
 * `flint` node downloads neither bundle, and a failed compile or a missing
 * asset degrades to the block's fallback instead of breaking the fence.
 * @module dsh-genui-charts/client/FlintNode
 */
import { useEffect, useRef, useState } from 'react'
import css from './GenuiBlock.module.css'
import { adaptChartOption } from './chart-layout.ts'
import { createChart, type EChartsInstance } from './echarts-lazy.ts'
import { compileFlintToEcharts } from './flint-lazy.ts'
import { useT } from './i18n/index.ts'
import type { GenuiFlint } from './spec.ts'

/** Series types the core engine bundle can draw; anything else needs the full one. */
const CORE_SERIES: ReadonlySet<string> = new Set(['bar', 'line', 'pie', 'scatter'])

/**
 * Pick the engine bundle the compiled option needs: Flint emits ordinary
 * series for the common chart types and exotic ones (heatmap, sankey, graph …)
 * for the rest, so the split follows the compiled series rather than the
 * requested chart type.
 * @param option - the option Flint compiled.
 * @returns 'core' when every series type is core-capable, otherwise 'full'.
 */
function neededEngine(option: Record<string, unknown>): 'core' | 'full' {
  const series = option.series
  if (!Array.isArray(series) || series.length === 0) return 'full'
  return series.every((entry) => {
    const type = typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      ? (entry as Record<string, unknown>).type
      : undefined
    return typeof type === 'string' && CORE_SERIES.has(type)
  }) ? 'core' : 'full'
}

/**
 * Flint node renderer.
 * @param props - the flint node from the spec.
 * @returns the chart block, a compile/engine fallback, or a progress hint.
 */
export function FlintNode({ node }: { node: GenuiFlint }) {
  const t = useT()
  const ref = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<EChartsInstance | null>(null)
  const [option, setOption] = useState<Record<string, unknown> | null>(null)
  const [engine, setEngine] = useState<'core' | 'full'>('core')
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const height = node.height ?? 300

  // Compile the model's assembly input into an option. A streamed update
  // replaces the option in place: the engine instance and the rendered chart
  // survive, and the previous option stays on screen until the new one lands.
  useEffect(() => {
    let alive = true
    void compileFlintToEcharts(node.input).then((compiled) => {
      if (!alive) return
      setEngine(neededEngine(compiled))
      setOption(compiled)
      setFailed(false)
    }).catch(() => {
      if (alive) setFailed(true)
    })
    return () => { alive = false }
  }, [node.input])

  // Mount the engine once a compiled option exists; cleanup disposes it.
  useEffect(() => {
    if (option === null) return
    const el = ref.current
    if (el === null) return
    let alive = true
    void createChart(el, adaptChartOption(option, el.clientWidth), { height }, engine).then((instance) => {
      if (!alive) {
        instance.dispose()
        return
      }
      instanceRef.current = instance
      setReady(true)
    }).catch(() => {
      if (alive) setFailed(true)
    })
    return () => {
      alive = false
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option === null])

  // Re-apply the latest option whenever it changes or the engine becomes
  // ready, so an update that landed during engine load is not lost.
  useEffect(() => {
    if (!ready || option === null) return
    const el = ref.current
    const instance = instanceRef.current
    if (el === null || instance === null) return
    instance.setOption(adaptChartOption(option, el.clientWidth), true)
  }, [option, ready])

  // Resize observer: the block moves when its grid column or the panel resizes.
  useEffect(() => {
    if (!ready) return
    const el = ref.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => instanceRef.current?.resize())
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [ready])

  if (failed) {
    return (
      <div className={css.echartFallback} data-genui-flint>
        <div className={css.echartErr}>{t('block.flintError')}</div>
      </div>
    )
  }

  return (
    <div className={css.echartWrap} data-genui-flint>
      <div
        ref={ref}
        className={css.echartCanvas}
        style={{ height: `${height}px` }}
        role="img"
        aria-label="Flint chart"
      />
      {option === null && <div className={css.echartHint}>{t('block.flintCompiling')}</div>}
      {option !== null && !ready && <div className={css.echartHint}>{t('block.chartLoading')}</div>}
    </div>
  )
}
