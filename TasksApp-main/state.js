export let state = {
    boards: [],
    currentBoardId: null,
    lists: [],
    tasks: [],
    currentView: 'board', // 'board', 'due_today', 'starred'
    activeTask: null,
    layout: localStorage.getItem('layout') || 'horizontal', // 'horizontal' or 'vertical'
    theme: localStorage.getItem('theme') || 'system', // 'light', 'dark', 'system'
    completedExpanded: {} // listId -> boolean
};

export function updateState(updates) {
    Object.assign(state, updates);
}

export function getState() {
    return state;
}
