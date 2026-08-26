/**
 * Runtime loader for the ECharts engine. The heavy echarts bundle ships as a
 * separate asset (`lib/assets/echarts.js`, served by the plugin's own HTTP
 * route) and is fetched ONLY when a spec contains an `echarts` or `flint`
 * node — the main client bundle stays small and most conversations never
 * download echarts at all. On a host that does not serve the asset the load
 * rejects and the chart node shows its fallback.
 * @module dsh-genui-charts/client/echarts-lazy
 */
import { loadGenuiAsset } from './asset-loader.ts'

/** The echarts engine surface registered by the echarts asset bundle. */
export interface EchartsAssetApi {
  init: (dom: HTMLElement) => {
    setOption: (option: Record<string, unknown>, notMerge?: boolean) => void
    resize: () => void
    dispose: () => void
  }
}

/**
 * Load the echarts engine surface (engine loaded on demand).
 * @returns the echarts asset api.
 * @throws when the asset cannot load or registers no `echarts` engine.
 */
export function loadEcharts(): Promise<EchartsAssetApi> {
  return loadGenuiAsset<EchartsAssetApi>('echarts')
}
