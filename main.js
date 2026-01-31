import { fetchBoards, fetchLists, fetchTasks } from './api.js';
import { renderApp } from './ui.js';
import * as UI from './ui.js';
import { state } from './state.js';

// Global Error Boundary
window.onerror = (msg, url, line, col, error) => {
    console.error('💥 Frontend Error:', { msg, url, line, col, error });
    // In prod, you'd send this to Sentry/LogRocket
    UI.showToast('An unexpected error occurred. Please refresh.');
};

window.onunhandledrejection = (event) => {
    console.error('💥 Unhandled Promise Rejection:', event.reason);
};

// Expose functions to window for onclick handlers
window.app = {
    ...UI,
    toggleDrawer: () => {
        const d = document.getElementById('drawer');
        if (d) d.classList.toggle('closed'); 
    }
};



document.addEventListener('DOMContentLoaded', async () => {
    UI.updateAuthUI();
    
    // Attempt silent login
    await UI.refreshSession(); // We'll add a UI wrapper or call api directly
    // Wait, let's call it from api.js directly to avoid UI import issues if UI doesn't export it yet
    
    // Check if we are logged in (via global state or local check)
    // For now, let's assume if we got a user, we proceed
    const user = JSON.parse(localStorage.getItem('user')); // User info is ok in localStorage, not token
    
    if (user) {
        await Promise.all([fetchBoards(), fetchLists()]);
        
        if (state.boards.length > 0) {
            state.currentBoardId = state.boards[0].id;
            // Fetch tasks for the current board selectively
            await fetchTasks(state.currentBoardId);
        }
        
        UI.renderApp();
    }
    
    UI.initKeyboardShortcuts();
    UI.initNotifications();
    UI.initCustomTheme();
});
