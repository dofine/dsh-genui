import type { SessionId } from '@deepseek-ai/dsh-session/types';
/**
 * 从宿主会话列表快照中解析当前主视图会话。
 *
 * @param list - 宿主提供的会话列表快照
 * @returns 当前会话标识；无法识别快照结构时返回 undefined
 */
export declare function resolveViewedSessionId(list: unknown): SessionId | undefined;
