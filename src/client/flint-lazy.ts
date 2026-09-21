/**
 * Runtime loader for the flint-chart assembler. Flint ships as a separate
 * asset (`lib/assets/flint.js`) loaded only when a spec contains a `flint`
 * node. It compiles a Flint `ChartAssemblyInput` into a backend-native
 * ECharts option, which the flint node then hands to the echarts engine.
 * @module dsh-genui-charts/client/flint-lazy
 */
import { loadGenuiAsset } from './asset-loader.ts'
import type { GenuiFlintInput } from './spec.ts'

/** The flint surface registered by the flint asset bundle. */
export interface FlintAssetApi {
  assembleECharts: (input: GenuiFlintInput) => Record<string, unknown>
}

/**
 * Compile a Flint `ChartAssemblyInput` into an ECharts option.
 * @param input - the Flint chart assembly input authored by the model.
 * @returns the backend-native ECharts option.
 * @throws when the asset cannot load or compilation fails.
 */
export async function compileFlintToEcharts(input: GenuiFlintInput): Promise<Record<string, unknown>> {
  const api = await loadGenuiAsset<FlintAssetApi>('flint')
  return api.assembleECharts(input)
}
