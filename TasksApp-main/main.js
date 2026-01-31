import { fetchBoards, fetchLists, fetchTasks } from './api.js';
import { renderApp } from './ui.js';
import * as UI from './ui.js';
import { state } from './state.js';

// Expose functions to window for onclick handlers
window.app = {
    ...UI
};

// Toggle Drawer helper since it was inline
window.toggleDrawer = () => {
    const d = document.getElementById('drawer');
    d.classList.toggle('closed'); 
};
window.toggleLayout = UI.toggleLayout;
window.toggleTheme = UI.toggleTheme;
window.setView = UI.setView;
window.createNewList = UI.createNewList;
window.createNewBoard = UI.createNewBoard;
window.closeDetails = UI.closeDetails;
window.deleteCurrentTask = UI.deleteCurrentTask;

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([fetchBoards(), fetchLists(), fetchTasks()]);
    
    if (state.boards.length > 0) {
         state.currentBoardId = state.boards[0].id;
    }
    
    UI.renderApp();
});
