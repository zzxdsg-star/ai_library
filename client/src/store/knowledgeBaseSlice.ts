import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { knowledgeApi } from '../api/knowledge.api';
import type { KnowledgeBase, CreateKnowledgeBaseRequest } from 'shared';

interface KBState {
  list: KnowledgeBase[];
  current: KnowledgeBase | null;
  total: number;
  page: number;
  loading: boolean;
}

const initialState: KBState = {
  list: [],
  current: null,
  total: 0,
  page: 1,
  loading: false,
};

export const fetchKBList = createAsyncThunk('kb/list', async (page: number) => {
  const res = await knowledgeApi.listKB(page);
  return res.data;
});

export const createKB = createAsyncThunk(
  'kb/create',
  async (data: CreateKnowledgeBaseRequest) => {
    const res = await knowledgeApi.createKB(data);
    return res.data;
  },
);

export const deleteKB = createAsyncThunk('kb/delete', async (id: string) => {
  await knowledgeApi.deleteKB(id);
  return id;
});

const knowledgeBaseSlice = createSlice({
  name: 'knowledgeBase',
  initialState,
  reducers: {
    setCurrentKB(state, action) {
      state.current = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchKBList.pending, (s) => {
        s.loading = true;
      })
      .addCase(fetchKBList.fulfilled, (s, action) => {
        s.loading = false;
        s.list = action.payload.records;
        s.total = action.payload.total;
        s.page = action.payload.current;
      })
      .addCase(fetchKBList.rejected, (s) => {
        s.loading = false;
      })
      .addCase(createKB.fulfilled, (s, action) => {
        s.list.unshift(action.payload);
      })
      .addCase(deleteKB.fulfilled, (s, action) => {
        s.list = s.list.filter((kb) => kb.id !== action.payload);
      });
  },
});

export const { setCurrentKB } = knowledgeBaseSlice.actions;
export default knowledgeBaseSlice.reducer;
