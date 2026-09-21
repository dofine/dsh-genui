/**
 * Container-aware layout defaults for compiled chart options. Every helper
 * fills a MISSING field only, so an explicit value from the model or from
 * Flint always wins; they exist because the host renders chart blocks inside
 * grid columns and panels whose width the spec author cannot know.
 * @module dsh-genui-charts/client/chart-layout
 */

/** Is `v` a plain object (not array, not null)? */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Ensure the option's `tooltip` is confined to the chart container: ECharts
 * defaults `confine: false`, so the tooltip can overflow past the block (and
 * past the viewport) at the margins. Set `confine: true` when the model (or
 * Flint) did not already choose a value, leaving every other tooltip field
 * untouched.
 * @param option - the compiled option.
 * @returns the option with a confined tooltip.
 */
export function withConfinedTooltip(option: Record<string, unknown>): Record<string, unknown> {
  const tooltip = option.tooltip
  if (isPlainObject(tooltip) && 'confine' in tooltip) return option
  const mergedTooltip = isPlainObject(tooltip) ? { ...tooltip, confine: true } : { confine: true }
  return { ...option, tooltip: mergedTooltip }
}

/**
 * Default `grid.containLabel: true` so axis labels stay inside the grid
 * margins instead of overlapping the plot or clipping at the block edge.
 * Only fills the default — an explicit `containLabel` (true or false) from
 * the model or Flint wins.
 * @param option - the compiled option.
 * @returns the option with label-containing grids.
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
 * @param option - the compiled option.
 * @returns the option with auto-thinned category tick labels.
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
 * @param option - the compiled option.
 * @returns the option with a compact pie layout.
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
 * Apply the container-aware defaults: confined tooltip, label-containing
 * grid, auto-thinned category ticks, and a compact pie layout when the block
 * is narrow.
 * @param option - the compiled option.
 * @param containerWidth - the block's current pixel width (0 when unknown).
 * @returns the adapted option.
 */
export function adaptChartOption(option: Record<string, unknown>, containerWidth: number): Record<string, unknown> {
  let out = withConfinedTooltip(option)
  out = withContainLabel(out)
  out = withAutoLabelInterval(out)
  if (containerWidth > 0 && containerWidth < 360) out = withCompactPie(out)
  return out
}
