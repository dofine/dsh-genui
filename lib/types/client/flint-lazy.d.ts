import type { GenuiFlintInput } from './spec.ts';
/** The flint surface registered by the flint asset bundle. */
export interface FlintAssetApi {
    assembleECharts: (input: GenuiFlintInput) => Record<string, unknown>;
}
/**
 * Compile a Flint `ChartAssemblyInput` into an ECharts option.
 * @param input - the Flint chart assembly input authored by the model.
 * @returns the backend-native ECharts option.
 * @throws when the asset cannot load or compilation fails.
 */
export declare function compileFlintToEcharts(input: GenuiFlintInput): Promise<Record<string, unknown>>;
