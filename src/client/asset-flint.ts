/**
 * Flint asset-bundle entry: registers the flint-chart ECharts assembler on
 * `window.__GenuiAssets__.flint`. Built as a standalone IIFE into
 * `lib/assets/flint.js` and served by the plugin's node-half route; loaded
 * on demand by flint-lazy. Only the `assembleECharts` subpath is bundled so
 * the asset stays small (the vega/plotly/chartjs/excel backends are not
 * needed).
 * @module dsh-genui-charts/client/asset-flint
 */
import { assembleECharts } from 'flint-chart/echarts'

const win = globalThis as unknown as { __GenuiAssets__?: Record<string, unknown> }
const assets = win.__GenuiAssets__ ?? (win.__GenuiAssets__ = {})
assets.flint = { assembleECharts }
