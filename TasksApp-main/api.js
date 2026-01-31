import { CONFIG } from './config.js';
import { state } from './state.js';

export async function api(endpoint, method, body) {
    try {
        const opts = { method, headers: {'Content-Type': 'application/json'} };
        if(body) opts.body = JSON.stringify(body);
        const res = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, opts);
        const data = await res.json();
        if (!res.ok) {
            return { error: data.error || 'Request failed' };
        }
        return data;
    } catch(e) { 
        console.error(e); 
        return { error: e.message }; 
    }
}

export async function fetchBoards() {
    try {
         const res = await fetch(`${CONFIG.BACKEND_URL}/boards`);
         state.boards = await res.json();
    } catch(e) { console.error(e); }
}

export async function fetchLists() {
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/lists`);
        state.lists = await res.json();
    } catch(e) { console.error(e); }
}

export async function fetchTasks() {
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/tasks`);
        state.tasks = await res.json();
    } catch(e) { console.error(e); }
}
