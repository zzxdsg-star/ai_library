import { get } from './client';

export interface HotEntry {
  entry_title: string;
  kb_name: string;
  total_hits: number;
}

export interface KBActivity {
  kb_id: string;
  kb_name: string;
  total_hits: number;
  entry_count: number;
}

export interface OverviewData {
  hotEntries: HotEntry[];
  kbActivity: KBActivity[];
  summary: { kbCount: number; entryCount: number; sessionCount: number };
}

export interface KBStatsData {
  kbName: string;
  hotEntries: Array<{ entry_title: string; total_hits: number; status: string }>;
}

export const analyticsApi = {
  getOverview: () => get<OverviewData>('/analytics/overview'),
  getKBStats: (kbId: string) => get<KBStatsData>(`/analytics/kb/${kbId}`),
};
