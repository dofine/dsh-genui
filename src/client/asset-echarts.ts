/**
 * ECharts asset-bundle entry: registers the echarts engine surface on
 * `window.__GenuiAssets__.echarts`. Built as a standalone IIFE into
 * `lib/assets/echarts.js` and served by the plugin's node-half route; loaded
 * on demand by echarts-lazy.
 * @module dsh-genui-charts/client/asset-echarts
 */
import * as echarts from 'echarts'

const win = globalThis as unknown as { __GenuiAssets__?: Record<string, unknown> }
const assets = win.__GenuiAssets__ ?? (win.__GenuiAssets__ = {})
// Expose only the instantiation surface; `setOption`/`resize`/`dispose` live
// on the per-instance chart object the component drives directly.
assets.echarts = { init: echarts.init }
