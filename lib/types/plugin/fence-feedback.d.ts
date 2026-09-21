/**
 * Fence feedback loop (issue #160): a reply whose ```dsh-ui fence the guard
 * cannot render should not stay broken for the reader. The host's
 * `agent/turn-stopping` boundary lets a plugin steer input into the SAME turn —
 * the machine re-reads its inbox and runs another step instead of closing
 * (see the `dsh-agent` runtime contract) — so the model can resend a corrected
 * fence while the user is still looking at the raw JSON.
 *
 * The loop is deliberately narrow, matching the contract agreed on the issue:
 * - **Opt-in.** `fenceFeedback: true` in this plugin's config; a host that does
 *   not ask for it never steers anything.
 * - **Bounded.** At most one correction per turn AND at most one per fence
 *   body per process, so a correction that is itself wrong cannot loop.
 * - **Never for subagents.** A child session's fence belongs to a parent reply.
 * - **Exact fence matching.** Only an info string of exactly `dsh-ui` opens a
 *   fence, so ` ```dsh-ui-dark `, indented prose, or a mention of the name is
 *   never rewritten.
 * - **Accounted before sending.** The fingerprint is recorded before `steer`,
 *   so a re-entrant boundary cannot deliver the same correction twice.
 * - **Cancellation-aware.** An aborted turn or a missing session is left alone.
 *
 * Detection reuses the renderer's own pipeline (`parsePartialGenuiSpec` →
 * `processGenuiSpec` → `isRenderableProcess`) and the tool's model-facing
 * diagnosis, so the correction quotes the same field errors the validator
 * reports.
 * @module dsh-genui-charts/plugin/fence-feedback
 */
import type { Context } from '@deepseek-ai/cordis';
import type { UserMessage } from '@deepseek-ai/dsh-session';
/** Plugin name recorded on every message this loop steers. */
export declare const FEEDBACK_PLUGIN_NAME = "dsh-genui-charts";
/** One ```dsh-ui fence found in an assistant reply. */
export interface ExtractedFence {
    /** Raw body between the fences (no delimiters). */
    readonly raw: string;
    /** False when the reply ended before the closing fence. */
    readonly closed: boolean;
    /** 1-based position among this reply's fences. */
    readonly index: number;
}
/**
 * Extract every ```dsh-ui fence from one assistant reply.
 *
 * @param text - the assistant message text.
 * @returns the fences in document order (at most {@link MAX_FENCES}).
 */
export declare function extractDshUiFences(text: string): ExtractedFence[];
/** Stable, log-safe identity of one fence body (same body → same fingerprint). */
export declare function fenceFingerprint(raw: string): string;
/** One fence the guard refuses to render, with its model-facing reason. */
export interface FenceFailure {
    readonly index: number;
    readonly fingerprint: string;
    /** Actionable diagnosis, in the same wording the validator tool uses. */
    readonly detail: string;
}
/**
 * Validate every fence in a reply the way the DOM channel would render it.
 *
 * @param text - the assistant message text.
 * @returns the fences that would stay a raw code block, in document order.
 */
export declare function fenceFailures(text: string): FenceFailure[];
/**
 * Build the correction input for a reply with unrenderable fences.
 *
 * @param failures - fences {@link fenceFailures} rejected.
 * @returns the message text to steer into the running turn.
 */
export declare function fenceCorrectionText(failures: readonly FenceFailure[]): string;
/**
 * Create the identified user-role message this loop steers.
 *
 * Mirrors `createUserMessage` from `@deepseek-ai/dsh-llm` (id + role + frozen)
 * without a runtime dependency on that package: the node half of this plugin
 * deliberately imports no `@deepseek-ai/*` values, so a linked or npm-installed
 * copy resolves identically on every host.
 *
 * @param text - the correction text.
 * @returns a frozen user message attributed to this plugin as a notice.
 */
export declare function createFeedbackMessage(text: string): UserMessage;
/** What the pure planner needs to decide whether a correction may be sent. */
export interface FenceFeedbackPlanInput {
    readonly text: string;
    readonly turn: number;
    readonly lastCorrectedTurn: number | undefined;
    readonly corrected: ReadonlySet<string>;
    readonly aborted: boolean;
}
/** A correction the caller must account for before steering. */
export interface FenceFeedbackPlan {
    readonly text: string;
    readonly fingerprints: readonly string[];
    readonly turn: number;
}
/**
 * Decide whether this turn boundary should steer a fence correction — the pure
 * core of the loop, so every bound (one per turn, one per fence, cancellation)
 * is testable without a host.
 *
 * @param input - reply text, turn identity, and the session's accounting.
 * @returns the correction to send, or null when the loop must stay silent.
 */
export declare function planFenceFeedback(input: FenceFeedbackPlanInput): FenceFeedbackPlan | null;
/**
 * Install the opt-in fence feedback loop.
 *
 * @param ctx - the host context.
 * @param enabled - the plugin config flag; the loop is inert when false.
 */
export declare function installFenceFeedback(ctx: Context, enabled: boolean): void;
