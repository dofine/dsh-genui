import type { GenuiFlint } from './spec.ts';
/**
 * Flint node renderer.
 * @param props - the flint node from the spec.
 * @returns the chart block, a compile/engine fallback, or a progress hint.
 */
export declare function FlintNode({ node }: {
    node: GenuiFlint;
}): import("react").JSX.Element;
