// ========== User ==========
export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ========== Knowledge Base ==========
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  system_prompt?: string;
}

// ========== Knowledge Entry ==========
export type EntryType = 'MANUAL' | 'FILE';
export type EntryStatus = 'ENABLED' | 'DISABLED';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface KnowledgeEntry {
  id: string;
  kb_id: string;
  title: string;
  content: string;
  type: EntryType;
  status: EntryStatus;
  processing_status: ProcessingStatus;
  source_file_name: string | null;
  source_file_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryRequest {
  title: string;
  content: string;
}

// ========== Chat ==========
export interface ChatSession {
  id: string;
  kb_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  references: Reference[] | null;
  token_usage: TokenUsage | null;
  created_at: string;
}

export interface Reference {
  id: string;
  title: string;
  content: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

// ========== API Response ==========
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PaginatedData<T> {
  total: number;
  records: T[];
  current: number;
  size: number;
}

// ========== SSE ==========
export interface SSEChunk {
  type: 'chunk' | 'done';
  content?: string;
  is_end: boolean;
  references?: Reference[];
  usage?: TokenUsage;
}
