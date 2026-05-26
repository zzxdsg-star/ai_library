import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { knowledgeApi } from '../api/knowledge.api';
import type { KnowledgeEntry, CreateEntryRequest } from 'shared';

interface EntryState {
  list: KnowledgeEntry[];
  total: number;
  page: number;
  search: string;
  statusFilter: string;
  loading: boolean;
}

const initialState: EntryState = {
  list: [],
  total: 0,
  page: 1,
  search: '',
  statusFilter: '',
  loading: false,
};

export const fetchEntries = createAsyncThunk(
  'entries/list',
  async (params: {
    kbId: string;
    page: number;
    search?: string;
    status?: string;
  }) => {
    const { kbId, page, search, status } = params;
    const res = await knowledgeApi.listEntries(kbId, page, 10, search, status);
    return res.data;
  },
);

export const createEntry = createAsyncThunk(
  'entries/create',
  async (params: { kbId: string; data: CreateEntryRequest }) => {
    const res = await knowledgeApi.createEntry(params.kbId, params.data);
    return res.data;
  },
);

export const deleteEntry = createAsyncThunk(
  'entries/delete',
  async (params: { kbId: string; eid: string }) => {
    await knowledgeApi.deleteEntry(params.kbId, params.eid);
    return params.eid;
  },
);

export const toggleEntryStatus = createAsyncThunk(
  'entries/toggleStatus',
  async (params: {
    kbId: string;
    eid: string;
    status: 'ENABLED' | 'DISABLED';
  }) => {
    const res = await knowledgeApi.updateEntryStatus(
      params.kbId,
      params.eid,
      params.status,
    );
    return res.data;
  },
);

const knowledgeEntrySlice = createSlice({
  name: 'knowledgeEntry',
  initialState,
  reducers: {
    setSearch(state, action) {
      state.search = action.payload;
      state.page = 1;
    },
    setStatusFilter(state, action) {
      state.statusFilter = action.payload;
      state.page = 1;
    },
    setPage(state, action) {
      state.page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntries.pending, (s) => {
        s.loading = true;
      })
      .addCase(fetchEntries.fulfilled, (s, action) => {
        s.loading = false;
        s.list = action.payload.records;
        s.total = action.payload.total;
        s.page = action.payload.current;
      })
      .addCase(fetchEntries.rejected, (s) => {
        s.loading = false;
      })
      .addCase(createEntry.fulfilled, (s, action) => {
        s.list.unshift(action.payload);
        s.total += 1;
      })
      .addCase(deleteEntry.fulfilled, (s, action) => {
        s.list = s.list.filter((e) => e.id !== action.payload);
        s.total -= 1;
      })
      .addCase(toggleEntryStatus.fulfilled, (s, action) => {
        const idx = s.list.findIndex((e) => e.id === action.payload.id);
        if (idx >= 0) s.list[idx] = action.payload;
      });
  },
});

export const { setSearch, setStatusFilter, setPage } =
  knowledgeEntrySlice.actions;
export default knowledgeEntrySlice.reducer;
