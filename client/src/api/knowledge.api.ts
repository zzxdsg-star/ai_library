import { get, post, put, del, patch } from './client';
import type {
  KnowledgeBase,
  KnowledgeEntry,
  PaginatedData,
  CreateKnowledgeBaseRequest,
  CreateEntryRequest,
} from 'shared';

export const knowledgeApi = {
  createKB: (data: CreateKnowledgeBaseRequest) =>
    post<KnowledgeBase>('/knowledge-bases', data),
  listKB: (page = 1, size = 10) =>
    get<PaginatedData<KnowledgeBase>>('/knowledge-bases', { page, size }),
  getKB: (id: string) =>
    get<KnowledgeBase>(`/knowledge-bases/${id}`),
  updateKB: (id: string, data: Partial<CreateKnowledgeBaseRequest>) =>
    put<KnowledgeBase>(`/knowledge-bases/${id}`, data),
  deleteKB: (id: string) =>
    del<null>(`/knowledge-bases/${id}`),

  createEntry: (kbId: string, data: CreateEntryRequest) =>
    post<KnowledgeEntry>(`/knowledge-bases/${kbId}/entries`, data),
  listEntries: (
    kbId: string,
    page = 1,
    size = 10,
    search?: string,
    status?: string,
  ) =>
    get<PaginatedData<KnowledgeEntry>>(`/knowledge-bases/${kbId}/entries`, {
      page,
      size,
      search,
      status,
    }),
  updateEntry: (
    kbId: string,
    eid: string,
    data: Partial<CreateEntryRequest>,
  ) => put<KnowledgeEntry>(`/knowledge-bases/${kbId}/entries/${eid}`, data),
  deleteEntry: (kbId: string, eid: string) =>
    del<null>(`/knowledge-bases/${kbId}/entries/${eid}`),
  updateEntryStatus: (
    kbId: string,
    eid: string,
    status: 'ENABLED' | 'DISABLED',
  ) =>
    patch<KnowledgeEntry>(`/knowledge-bases/${kbId}/entries/${eid}/status`, {
      status,
    }),

  uploadFile: (kbId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    return fetch(`/api/knowledge-bases/${kbId}/entries/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then((r) => r.json());
  },
};
