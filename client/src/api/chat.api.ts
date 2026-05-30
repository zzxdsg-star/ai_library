import { get, post, del, postStream } from './client';
import type { ChatSession, ChatMessage, SSEChunk } from 'shared';

export const chatApi = {
  createSession: (kbId: string) =>
    post<ChatSession>(`/knowledge-bases/${kbId}/chat/sessions`),
  listSessions: (kbId: string) =>
    get<ChatSession[]>(`/knowledge-bases/${kbId}/chat/sessions`),
  getMessages: (kbId: string, sid: string) =>
    get<ChatMessage[]>(`/knowledge-bases/${kbId}/chat/sessions/${sid}`),
  deleteSession: (kbId: string, sid: string) =>
    del<null>(`/knowledge-bases/${kbId}/chat/sessions/${sid}`),
  sendMessage: (kbId: string, sid: string, content: string) =>
    postStream<SSEChunk>(
      `/knowledge-bases/${kbId}/chat/sessions/${sid}/messages`,
      { content },
    ),
  /** 从对话中提炼知识 */
  extractKnowledge: (kbId: string, sessionId?: string) =>
    post<{ entries: Array<{ id: string; title: string }>; count: number }>(
      `/knowledge-bases/${kbId}/chat/extract`,
      { sessionId },
    ),
};
