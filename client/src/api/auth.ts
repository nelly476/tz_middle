import axios from 'axios';

const API = 'http://localhost:3000/api/auth';

export const login = (data: { username: string; password: string }) => axios.post(`${API}/login`, data);
export const register = (data: { username: string; password: string }) => axios.post(`${API}/register`, data);
export const refresh = (refreshToken: string) => axios.post(`${API}/refresh`, { refresh_token: refreshToken });
