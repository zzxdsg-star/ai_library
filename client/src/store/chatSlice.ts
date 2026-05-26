import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { chatApi } from '../api/chat.api';
import type { ChatSession, ChatMessage } from 'shared';

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  streamingContent: string;
  loading: boolean;
}

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  streaming: false,
  streamingContent: '',
  loading: false,
};

export const fetchSessions = createAsyncThunk(
  'chat/sessions',
  async (kbId: string) => {
    const res = await chatApi.listSessions(kbId);
    return res.data;
  },
);

export const createSession = createAsyncThunk(
  'chat/createSession',
  async (kbId: string) => {
    const res = await chatApi.createSession(kbId);
    return res.data;
  },
);

export const fetchMessages = createAsyncThunk(
  'chat/messages',
  async (params: { kbId: string; sid: string }) => {
    const res = await chatApi.getMessages(params.kbId, params.sid);
    return { messages: res.data, sid: params.sid };
  },
);

export const deleteSession = createAsyncThunk(
  'chat/deleteSession',
  async (params: { kbId: string; sid: string }) => {
    await chatApi.deleteSession(params.kbId, params.sid);
    return params.sid;
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentSession(state, action) {
      state.currentSessionId = action.payload;
    },
    appendStreamChunk(state, action) {
      state.streamingContent += action.payload;
    },
    startStreaming(state) {
      state.streaming = true;
      state.streamingContent = '';
    },
    stopStreaming(state) {
      state.streaming = false;
    },
    addMessage(state, action) {
      state.messages.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessions.fulfilled, (s, action) => {
        s.sessions = action.payload;
      })
      .addCase(createSession.fulfilled, (s, action) => {
        s.sessions.unshift(action.payload);
        s.currentSessionId = action.payload.id;
        s.messages = [];
      })
      .addCase(fetchMessages.fulfilled, (s, action) => {
        s.messages = action.payload.messages;
        s.currentSessionId = action.payload.sid;
      })
      .addCase(deleteSession.fulfilled, (s, action) => {
        s.sessions = s.sessions.filter((sess) => sess.id !== action.payload);
        if (s.currentSessionId === action.payload) {
          s.currentSessionId = null;
          s.messages = [];
        }
      });
  },
});

export const {
  setCurrentSession,
  appendStreamChunk,
  startStreaming,
  stopStreaming,
  addMessage,
} = chatSlice.actions;
export default chatSlice.reducer;
