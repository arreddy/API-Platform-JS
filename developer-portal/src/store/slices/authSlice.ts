import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  username: string;
  organizationId: string | null;
  role: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
}

const storedToken = localStorage.getItem('token');
const storedUser  = localStorage.getItem('user');

const initialState: AuthState = {
  token:        storedToken,
  refreshToken: localStorage.getItem('refreshToken'),
  user:         storedUser ? JSON.parse(storedUser) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; refreshToken: string; user: User }>) {
      state.token        = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user         = action.payload.user;
      localStorage.setItem('token',        action.payload.token);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      localStorage.setItem('user',         JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.token        = null;
      state.refreshToken = null;
      state.user         = null;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
