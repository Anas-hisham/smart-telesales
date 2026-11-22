import type { AiLang, KnowledgeDraft, KnowledgeItem, LeadAnalysisResponse } from '@/features/ai/types/ai.types';
import { del, get, patch, post } from '@/shared/api/client';

const inflight = new Map<string, Promise<LeadAnalysisResponse>>();

export const aiApi = {
  /** The same request made twice at once (React strict mode, a double click) is sent once: every call may cost AI quota. */
  analyzeLead(leadId: string, options: { lang: AiLang; refresh: boolean }) {
    const key = `${leadId}|${options.lang}|${options.refresh}`;
    const running = inflight.get(key);
    if (running) return running;
    const request = post<LeadAnalysisResponse>(`/leads/${encodeURIComponent(leadId)}/ai-analysis`, options).finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  },
  listKnowledge: () => get<KnowledgeItem[]>('/ai/knowledge'),
  createKnowledge: (body: KnowledgeDraft) => post<KnowledgeItem>('/ai/knowledge', body),
  updateKnowledge: (id: string, body: Partial<KnowledgeDraft> & { active?: boolean }) => patch<KnowledgeItem>(`/ai/knowledge/${encodeURIComponent(id)}`, body),
  removeKnowledge: (id: string) => del<void>(`/ai/knowledge/${encodeURIComponent(id)}`),
};
