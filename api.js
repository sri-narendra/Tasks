import axios from 'axios';
import { state } from './state.js';
import { CONFIG } from './config.js';

// In-memory token storage (No localStorage!)
let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};

// Create Axios Instance
const apiClient = axios.create({
    baseURL: CONFIG.BACKEND_URL + '/api',
    withCredentials: true,
    timeout: 30000, // 30s timeout for Render cold-starts
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use(config => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
}, error => Promise.reject(error));

// Response Interceptor: refresh Logic & Resilience
apiClient.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const code = error.code;

        // 1. SUPPRESS RETRIES for auth/rate-limit blocks
        const nonRetryable = [401, 403, 429];
        if (nonRetryable.includes(status)) {
            // Specialized 401 Silent Refresh logic
            if (status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh')) {
                originalRequest._retry = true;
                try {
                    const res = await axios.post(CONFIG.BACKEND_URL + '/api/auth/refresh', {}, { withCredentials: true });
                    if (res.data.token) {
                        accessToken = res.data.token;
                        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                        return apiClient(originalRequest);
                    }
                } catch (err) {
                    accessToken = null;
                    localStorage.removeItem('user');
                    window.dispatchEvent(new CustomEvent('app:auth-expired'));
                    return Promise.reject(err);
                }
            }
            return Promise.reject(error);
        }

        // 2. NETWORK FAILURE / TIMEOUT Handling
        if (code === 'ECONNABORTED' || !window.navigator.onLine || !error.response) {
            window.dispatchEvent(new CustomEvent('app:network-error', { 
                detail: { 
                    message: code === 'ECONNABORTED' ? 'Request timed out' : 'Network connection lost' 
                } 
            }));
        }

        return Promise.reject(error);
    }
);

// Wrapper to match old `api(endpoint, method, body)` signature
export async function api(endpoint, method = 'GET', body = null) {
    try {
        const res = await apiClient({
            url: endpoint,
            method,
            data: body
        });
        return res; // Interceptor returns response.data
    } catch (err) {
        // Map axios error to `{ error: message, details: [...] }`
        const msg = err.response?.data?.error || err.message;
        const details = err.response?.data?.details;
        return { error: msg, details };
    }
}

export async function login(email, password) {
    const res = await api('/auth/login', 'POST', { email, password });
    if (!res.error) {
        accessToken = res.token;
        // Don't store in localStorage!
        // We might store user generic info
        localStorage.setItem('user', JSON.stringify(res.user));
    }
    return res;
}

export async function register(email, password) {
    const res = await api('/auth/register', 'POST', { email, password });
    if (!res.error) {
        accessToken = res.token;
        localStorage.setItem('user', JSON.stringify(res.user));
    }
    return res;
}

export async function logout() {
    await api('/auth/logout', 'POST');
    accessToken = null;
    localStorage.removeItem('user');
    window.location.reload();
}

export async function refreshSession() {
    try {
        const res = await axios.post(CONFIG.BACKEND_URL + '/api/auth/refresh', {}, { withCredentials: true });
        if (res.data.token) {
            accessToken = res.data.token;
            return res.data.user; // If controller returns user on refresh
        }
    } catch (err) {
        return null;
    }
    return null;
}

// Fetchers update state directly (Old pattern)
export async function fetchBoards() {
    const data = await api('/boards');
    if (!data.error) state.boards = data;
}

export async function fetchLists() {
    const data = await api('/lists');
    if (!data.error) state.lists = data;
}

export async function fetchTasks(boardId = state.currentBoardId) {
    const endpoint = boardId ? `/tasks?boardId=${boardId}` : '/tasks';
    const data = await api(endpoint);
    if (!data.error) state.tasks = data;
}
