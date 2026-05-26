import { createSlice } from '@reduxjs/toolkit';

interface UIState {
  globalLoading: boolean;
}

const initialState: UIState = { globalLoading: false };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading(state, action) {
      state.globalLoading = action.payload;
    },
  },
});

export const { setGlobalLoading } = uiSlice.actions;
export default uiSlice.reducer;
