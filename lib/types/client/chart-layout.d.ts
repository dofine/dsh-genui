/**
 * Container-aware layout defaults for compiled chart options. Every helper
 * fills a MISSING field only, so an explicit value from the model or from
 * Flint always wins; they exist because the host renders chart blocks inside
 * grid columns and panels whose width the spec author cannot know.
 * @module dsh-genui-charts/client/chart-layout
 */
/**
 * Ensure the option's `tooltip` is confined to the chart container: ECharts
 * defaults `confine: false`, so the tooltip can overflow past the block (and
 * past the viewport) at the margins. Set `confine: true` when the model (or
 * Flint) did not already choose a value, leaving every other tooltip field
 * untouched.
 * @param option - the compiled option.
 * @returns the option with a confined tooltip.
 */
export declare function withConfinedTooltip(option: Record<string, unknown>): Record<string, unknown>;
/**
 * Default `grid.containLabel: true` so axis labels stay inside the grid
 * margins instead of overlapping the plot or clipping at the block edge.
 * Only fills the default — an explicit `containLabel` (true or false) from
 * the model or Flint wins.
 * @param option - the compiled option.
 * @returns the option with label-containing grids.
 */
export declare function withContainLabel(option: Record<string, unknown>): Record<string, unknown>;
/**
 * Default `axisLabel.interval: 'auto'` on category axes so a narrow
 * container thins the tick labels instead of overlapping them. Explicit
 * `interval` values from the model or Flint are left untouched.
 * @param option - the compiled option.
 * @returns the option with auto-thinned category tick labels.
 */
export declare function withAutoLabelInterval(option: Record<string, unknown>): Record<string, unknown>;
/**
 * Compact pie layout for narrow containers (< 360px): Flint emits fixed-px
 * radii (e.g. `["36px","80px"]`) and outside labels tuned for its ~400px
 * base size, which overflow and overlap when a grid column squeezes the
 * chart. Take over only the layout fields then — percentage radii, inside
 * labels, no leader lines.
 * @param option - the compiled option.
 * @returns the option with a compact pie layout.
 */
export declare function withCompactPie(option: Record<string, unknown>): Record<string, unknown>;
/**
 * Apply the container-aware defaults: confined tooltip, label-containing
 * grid, auto-thinned category ticks, and a compact pie layout when the block
 * is narrow.
 * @param option - the compiled option.
 * @param containerWidth - the block's current pixel width (0 when unknown).
 * @returns the adapted option.
 */
export declare function adaptChartOption(option: Record<string, unknown>, containerWidth: number): Record<string, unknown>;
