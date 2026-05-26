import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import knowledgeBaseReducer from './knowledgeBaseSlice';
import knowledgeEntryReducer from './knowledgeEntrySlice';
import chatReducer from './chatSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    knowledgeBase: knowledgeBaseReducer,
    knowledgeEntry: knowledgeEntryReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
