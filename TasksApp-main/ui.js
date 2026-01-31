import { state } from './state.js';
import { api, fetchBoards, fetchLists, fetchTasks } from './api.js';

// --- HELPERS ---
function calculateNextDueDate(currentDateStr, recurrenceStr) {
    if (!currentDateStr || !recurrenceStr) return null;
    const date = new Date(currentDateStr);
    const [type, value] = recurrenceStr.split(':');
    
    switch (type) {
        case 'daily':
            date.setDate(date.getDate() + 1);
            break;
        case 'weekly':
            const days = value ? value.split(',').map(Number) : [date.getDay()];
            let dayFound = false;
            for (let i = 1; i <= 7; i++) {
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + i);
                if (days.includes(nextDate.getDay())) {
                    date.setTime(nextDate.getTime());
                    dayFound = true;
                    break;
                }
            }
            if (!dayFound) date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            const targetDates = value ? value.split(',').map(Number).sort((a,b) => a-b) : [date.getDate()];
            let found = false;
            let year = date.getFullYear();
            
            // Check current month
            for (let d of targetDates) {
                if (d > date.getDate()) {
                    const candidate = new Date(year, date.getMonth(), d, date.getHours(), date.getMinutes());
                    if (candidate.getMonth() === date.getMonth()) {
                        date.setTime(candidate.getTime());
                        found = true;
                        break;
                    }
                }
            }

            // If not found, check next month
            if (!found) {
                let nextMonth = date.getMonth() + 1;
                let nextYear = year;
                if (nextMonth > 11) {
                    nextMonth = 0;
                    nextYear++;
                }
                const d = targetDates[0];
                const candidate = new Date(nextYear, nextMonth, d, date.getHours(), date.getMinutes());
                if (candidate.getMonth() !== nextMonth) {
                    candidate.setDate(0); 
                }
                date.setTime(candidate.getTime());
            }
            break;
        default:
            return currentDateStr;
    }
    
    return date.toISOString();
}

// --- HELPERS ---
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

/* --- CUSTOM DIALOGS --- */
export function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function showModal({ title, placeholder = '', initialValue = '', confirmText = 'OK', showInput = true }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const titleEl = document.getElementById('modalTitle');
        const input = document.getElementById('modalInput');
        const cancelBtn = document.getElementById('modalCancel');
        const confirmBtn = document.getElementById('modalConfirm');

        titleEl.textContent = title;
        input.value = initialValue;
        input.placeholder = placeholder;
        input.style.display = showInput ? 'block' : 'none';
        confirmBtn.textContent = confirmText;

        const close = (val) => {
            modal.classList.remove('active');
            resolve(val);
        };

        cancelBtn.onclick = () => close(null);
        confirmBtn.onclick = () => {
            const val = showInput ? input.value : true;
            close(val);
        };

        // Enter key for input
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        };

        modal.classList.add('active');
        if (showInput) setTimeout(() => input.focus(), 100);
    });
}

// --- RENDERING ---
export function renderApp() {
    initTheme();
    renderLayoutIcon();
    renderDrawer();
    renderBoard();
}

export function setView(view) {
    state.currentView = view;
    renderDrawer(); // Update active state
    renderBoard(); // Update headers/content
}

export function switchBoard(boardId) {
    state.currentBoardId = boardId;
    setView('board');
}

// --- DRAWER ---
function renderDrawer() {
     const container = document.getElementById('drawerBoards');
     container.innerHTML = state.boards.map(board => `
         <div class="drawer-item ${state.currentBoardId === board.id && state.currentView === 'board' ? 'active' : ''}" 
              onclick="window.app.switchBoard('${board.id}')"
              ondragover="event.preventDefault()"
              ondrop="window.app.handleCrossBoardDrop(event, '${board.id}')">
            <span class="drawer-icon">dashboard</span>
            <span class="drawer-label">${escapeHtml(board.title)}</span>
            <span class="material-icons board-menu-trigger" onclick="window.app.showBoardMenu('${board.id}', event)">more_vert</span>
         </div>
     `).join('');
     
     // Update active class for static items
     document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
     
     // Note: This simple logic might need refinement if static items have IDs, 
     // but for now we rely on the clicked one having 'active' or re-rendering.
     // Let's re-apply active based on view manually for static items:
     const map = { 'board': -1, 'due_today': 1, 'starred': 2 }; 
     // Values correspond to index in DOM... brittle. 
     // Better: IDs. But let's stick to rendered logic for dynamic boards.
     
     const view = state.currentView;
     if (view === 'due_today') document.querySelectorAll('.drawer-item')[1].classList.add('active');
     if (view === 'starred') document.querySelectorAll('.drawer-item')[2].classList.add('active');
     if (view === 'board') {
         // Active class added in map above
     }

      // Title
      if (view === 'board') {
         const b = state.boards.find(b => b.id === state.currentBoardId);
         document.getElementById('viewTitle').textContent = b ? b.title : 'Board';
      } else {
         const titles = { 'due_today': 'Due Today', 'starred': 'Starred Tasks' };
         document.getElementById('viewTitle').textContent = titles[view];
      }
 }

 // Background Helper
 export function applyBoardBackground() {
     const view = state.currentView;
     const boardCont = document.getElementById('boardContainer');
     if (!boardCont) return;

     if (view === 'board') {
         const b = state.boards.find(b => b.id === state.currentBoardId);
         if (b && b.background) {
             if (b.background.startsWith('http') || b.background.startsWith('data:')) {
                 boardCont.style.backgroundImage = `url(${b.background})`;
                 boardCont.style.backgroundColor = '';
             } else {
                 boardCont.style.backgroundColor = b.background;
                 boardCont.style.backgroundImage = '';
             }
         } else {
             boardCont.style.backgroundColor = '';
             boardCont.style.backgroundImage = '';
         }
     } else {
         boardCont.style.backgroundColor = '';
         boardCont.style.backgroundImage = '';
     }
 }

// --- DRAG STATE ---
state.dragItem = null; // { id, type: 'list'|'task' }

// --- BOARD MENU ---
export function showBoardMenu(boardId, event) {
    if (event) {
        event.stopPropagation();
    }
    const board = state.boards.find(b => b.id === boardId);
    if (!board) return;

    let menu = document.getElementById('boardMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'boardMenu';
        menu.className = 'dropdown-menu';
        document.body.appendChild(menu);
    }

    const rect = event.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;

    const quickColors = ['', '#1a73e8', '#c5221f', '#f29900', '#188038', '#8e24aa', '#a142f4', '#00796b', '#3f51b5', '#455a64'];
    const isImage = board.background && (board.background.startsWith('data:') || board.background.startsWith('http'));

    menu.innerHTML = `
        <div class="dropdown-item" onclick="window.app.renameBoardFromMenu()">
            <span class="material-icons">edit</span> Rename Board
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-section-title">Background Color Quick Select</div>
        <div class="color-picker-grid">
            ${quickColors.map(c => `
                <div class="color-circle ${!isImage && board.background === c ? 'active' : ''}" 
                     style="background: ${c === '' ? 'var(--surface)' : c}; border: ${c === '' ? '1px solid var(--border)' : 'none'};" 
                     onclick="window.app.previewBoardBackground('${boardId}', '${c}', true)">
                     ${c === '' ? '<span class="material-icons" style="font-size:16px;color:var(--text-secondary)">block</span>' : ''}
                </div>
            `).join('')}
        </div>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-section-title">Custom Color</div>
        <div class="custom-color-picker">
            <input type="color" id="boardColorPicker" value="${(!isImage && board.background && board.background.startsWith('#')) ? board.background : '#ffffff'}" 
                   oninput="window.app.previewBoardBackground('${boardId}', this.value, true)">
            <input type="text" id="boardColorHex" class="custom-color-input" value="${!isImage ? (board.background || '') : ''}" placeholder="#HEXCODE"
                   oninput="window.app.previewBoardBackground('${boardId}', this.value, true)">
        </div>

        <div class="dropdown-divider"></div>
        <div class="dropdown-section-title">Media</div>
        <div class="dropdown-item" onclick="window.app.triggerBoardBackgroundImageUpload()">
            <span class="material-icons">file_upload</span> Upload Image
        </div>
        <div class="dropdown-item" onclick="window.app.changeBoardImageUrlFromMenu()">
            <span class="material-icons">link</span> Set Image URL
        </div>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" style="color: #d93025;" onclick="window.app.deleteBoardFromMenu()">
            <span class="material-icons" style="color: #d93025;">delete</span> Delete Board
        </div>
    `;

    menu.classList.add('active');
    state.activeBoardId = boardId;

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.classList.remove('active');
            document.removeEventListener('mousedown', closeMenu);
            // RESET: Ensure we revert to the actual saved background of the current board
            applyBoardBackground();
        }
    };
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 10);
}

export async function renameBoardFromMenu() {
    const boardId = state.activeBoardId;
    const board = state.boards.find(b => b.id === boardId);
    if (!board) return;

    const newName = await showModal({ title: 'Rename Board', showInput: true, initialValue: board.title });
    if (newName && newName !== board.title) {
        board.title = newName;
        renderDrawer();
        if (state.currentBoardId === boardId) {
             document.getElementById('viewTitle').textContent = newName;
        }
        await api(`/boards/${boardId}`, 'PATCH', { title: newName });
        showToast(`Board renamed to ${newName}`);
    }
}

export async function changeBoardBackgroundColorFromMenu() {
    // Legacy - content is now dynamic in showBoardMenu
}

export async function setBoardBackground(boardId, color, skipRender = false) {
    if (color === undefined || color === null) return;
    try {
        const normalizedColor = color === 'transparent' || color === '' ? null : color;
        const board = state.boards.find(b => b.id === boardId);
        if (!board) return;

        const oldBg = board.background;
        board.background = normalizedColor;
        
        const res = await api(`/boards/${boardId}`, 'PATCH', { background: normalizedColor });
        if (res.error) {
            board.background = oldBg;
            if (!skipRender && state.currentBoardId === boardId) renderBoard();
            throw new Error(res.error);
        }
        
        if (!skipRender && state.currentBoardId === boardId) renderBoard();
    } catch (err) {
        showToast(err.message);
    }
}

let boardColorSaveTimeout = null;
export function previewBoardBackground(boardId, color, autoSave = false) {
    const board = state.boards.find(b => b.id === boardId);
    if (!board) return;

    // Apply immediate visual preview ONLY if this is the board the user is currently looking at
    if (state.currentBoardId === boardId) {
        const boardCont = document.getElementById('boardContainer');
        if (boardCont) {
            if (color && (color.startsWith('#') || color.length > 0)) {
                 boardCont.style.backgroundColor = color;
                 boardCont.style.backgroundImage = '';
            } else {
                 boardCont.style.backgroundColor = '';
                 boardCont.style.backgroundImage = '';
            }
        }
    }

    // Sync UI inputs if they exist in the dynamic menu
    const hexInput = document.getElementById('boardColorHex');
    if (hexInput && document.activeElement !== hexInput) hexInput.value = color || '';
    
    const pickerInput = document.getElementById('boardColorPicker');
    if (pickerInput && color && color.startsWith('#') && color.length === 7) pickerInput.value = color;

    if (autoSave) {
        clearTimeout(boardColorSaveTimeout);
        boardColorSaveTimeout = setTimeout(() => {
            if (!color || (color.startsWith('#') && (color.length === 7 || color.length === 4))) {
                setBoardBackground(boardId, color, true);
            }
        }, 800);
    }
}

export async function changeBoardImageUrlFromMenu() {
    const boardId = state.activeBoardId;
    const board = state.boards.find(b => b.id === boardId);
    if (!board) return;

    const oldBg = board.background;
    const val = await showModal({ title: 'Image URL', showInput: true, initialValue: board.background && board.background.startsWith('http') ? board.background : '' });
    if (val !== null) {
        board.background = val;
        renderBoard();
        const res = await api(`/boards/${boardId}`, 'PATCH', { background: val });
        if (res.error) {
            board.background = oldBg;
            renderBoard();
            showToast("Failed to save background: " + res.error);
        } else {
            showToast('Image URL updated');
        }
    }
}

export function triggerBoardBackgroundImageUpload() {
    document.getElementById('boardBackgroundInput').click();
}

export async function handleBoardBackgroundImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
        showToast("Image too large (max 50MB)");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const boardId = state.activeBoardId;
        const board = state.boards.find(b => b.id === boardId);
        if (!board) return;

        const oldBg = board.background;
        const base64 = e.target.result;
        board.background = base64;
        renderBoard();
        
        const res = await api(`/boards/${boardId}`, 'PATCH', { background: base64 });
        if (res.error) {
            board.background = oldBg;
            renderBoard();
            showToast("Failed to upload: " + res.error);
        } else {
            showToast('Background image uploaded');
        }
    };
    reader.readAsDataURL(file);
}

export async function deleteBoardFromMenu() {
    const boardId = state.activeBoardId;
    const confirmed = await showModal({ title: 'Delete board and all its tasks? This cannot be undone.', showInput: false });
    if (confirmed) {
        state.boards = state.boards.filter(b => b.id !== boardId);
        if (state.currentBoardId === boardId) {
            state.currentBoardId = state.boards.length > 0 ? state.boards[0].id : null;
        }
        renderApp();
        await api(`/boards/${boardId}`, 'DELETE');
        showToast('Board deleted');
    }
}

export async function handleCrossBoardDrop(evt, targetBoardId) {
    evt.preventDefault();
    evt.stopPropagation();
    
    // Use stored state if available, or try DOM fallback
    const draggedItem = state.dragItem;
    
    if (!draggedItem) {
        console.warn("No dragged item state found.");
        return;
    }

    // A. Dragging a LIST
    if (draggedItem.type === 'list') {
        const listId = draggedItem.id;
        
        // Don't drop on same board
        if (state.currentBoardId === targetBoardId) return;

        // Optimistic UI Update: Remove from current view
        const el = document.querySelector(`.list-column[data-id="${listId}"]`);
        if (el) el.remove();
        
        // Update State
        const list = state.lists.find(l => l.id === listId);
        if (list) list.board_id = targetBoardId;
        
        // API Update
        await api(`/lists/${listId}`, 'PATCH', { boardId: targetBoardId });
        
        renderApp(); 
    } 
    // B. Dragging a TASK
    else if (draggedItem.type === 'task') {
        const taskId = draggedItem.id;
        
        // Find suitable list in target board
        let targetLists = state.lists
            .filter(l => l.board_id === targetBoardId)
            .sort((a,b) => a.position - b.position);

        if (targetLists.length === 0) {
            showToast("Cannot move task: Target board has no lists.");
            return;
        }
        
        const targetList = targetLists[0]; // Drop into first list
        
        // Optimistic UI
        const el = document.querySelector(`.task-card[data-id="${taskId}"]`);
        if (el) el.remove();
        
        // State Update
        const task = state.tasks.find(t => t.id === taskId);
        if (task) task.list_id = targetList.id;
        
        // API Update
        await api(`/tasks/${taskId}`, 'PATCH', { list_id: targetList.id });
        
        renderApp();
    }
    
    state.dragItem = null; // Clear
}

function renderBoard() {
    applyBoardBackground();
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';
    
    let relevantLists = state.lists;

    if (state.currentView === 'board') {
         if (!state.currentBoardId) {
             container.innerHTML = '<div style="padding: 24px;">Please create a board.</div>';
             return;
         }
         relevantLists = state.lists.filter(l => l.board_id === state.currentBoardId);
    }
    
    // 1. BOARD VIEW Logic
    if (state.currentView === 'board') {
        relevantLists.forEach(list => renderListColumn(list, container));
        
        // Add List Button
        const addBtn = document.createElement('div');
        addBtn.className = 'new-list-column';
        addBtn.textContent = '+ Add New List';
        addBtn.onclick = window.app.createNewList;
        container.appendChild(addBtn);

        new Sortable(container, {
            animation: 200,
            handle: '.list-header',
            draggable: '.list-column',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onStart: (evt) => {
                state.dragItem = { id: evt.item.dataset.id, type: 'list' };
            },
            onEnd: (evt) => { 
                handleListReorder(evt);
                // Don't clear immediately if dropped outside? 
                // Actually Drop event happens before End? 
                // Native Drop: fires on drop target. Sortable End: fires on source.
                // If native drop happened, state.dragItem might be cleared there?
                // Let's clear it here just in case.
                setTimeout(() => state.dragItem = null, 100);
            }
        });
        return;
    }

    // 2. SMART VIEWS
    let hasTasks = false;
    state.lists.forEach(list => {
        let listTasks = state.tasks.filter(t => t.list_id === list.id);
        
        if (state.currentView === 'due_today') {
            const today = new Date().toISOString().split('T')[0];
            listTasks = listTasks.filter(t => t.due_date && t.due_date.startsWith(today));
        } else if (state.currentView === 'starred') {
            listTasks = listTasks.filter(t => t.is_starred);
        }
        
        if (listTasks.length > 0) {
            hasTasks = true;
            const board = state.boards.find(b => b.id === list.board_id);
            const contextTitle = board ? `${board.title} > ${list.title}` : list.title;
            renderListColumn({ ...list, title: contextTitle }, container, listTasks, true);
        }
    });

    if (!hasTasks) {
        container.innerHTML = `<div style="padding: 24px; color: var(--text-secondary);">No tasks found.</div>`;
    }
}

function renderListColumn(list, container, filteredTasks = null, readOnly = false) {
     const listEl = document.createElement('div');
     listEl.className = 'list-column';
     listEl.dataset.id = list.id;
     
     // Apply List Color
     if (list.color) {
         // Apply to background with slight opacity for readability if desired, 
         // but user said "total list", so let's go with a themed background approach.
         listEl.style.backgroundColor = list.color;
         // If a background color is set, we might want to adjust border-top too for accent
         listEl.style.borderTopColor = 'rgba(0,0,0,0.1)';
     }

     const allTasks = filteredTasks || state.tasks.filter(t => t.list_id === list.id);
     
     // SPLIT LOGIC
     const activeTasks = allTasks.filter(t => !t.completed);
     // Sort completed by completed_at desc (newest first)
     const completedTasks = allTasks
        .filter(t => t.completed)
        .sort((a, b) => {
            const dateA = a.completed_at ? new Date(a.completed_at) : new Date(0);
            const dateB = b.completed_at ? new Date(b.completed_at) : new Date(0);
            return dateB - dateA;
        });
     
     const isExpanded = state.completedExpanded[list.id] || false;

      listEl.innerHTML = `
          <div class="list-header">
              <span class="list-title" ${!readOnly ? `ondblclick="window.app.renameList('${list.id}')"` : ''}>${escapeHtml(list.title)}</span>
              ${!readOnly ? `<span class="material-icons list-menu" onclick="window.app.showListMenu('${list.id}', event)">more_vert</span>` : ''}
          </div>
      `;
 
      // LIST BODY (SCROLLABLE)
      const listBody = document.createElement('div');
      listBody.className = 'list-body';

      // Inline Add Task (Now inside scroll area to prevent overlap)
      if (!readOnly) {
          const addWrap = document.createElement('div');
          addWrap.className = 'add-task-wrapper';
          addWrap.innerHTML = `
              <input class="add-task-input" placeholder="+ Add a task" 
                     onkeydown="if(event.key==='Enter') window.app.addTask(this, '${list.id}')">
          `;
          listBody.appendChild(addWrap);
      }

     // ACTIVE
     const tasksContainer = document.createElement('div');
     tasksContainer.className = 'tasks-container';
     tasksContainer.id = `list-${list.id}`;
     activeTasks.forEach(task => tasksContainer.appendChild(createTaskEl(task, list.task_color)));
     listBody.appendChild(tasksContainer);
     
     // COMPLETED
     if (completedTasks.length > 0) {
         const completedSection = document.createElement('div');
         completedSection.className = 'completed-section';
         completedSection.innerHTML = `
            <div class="completed-header" onclick="window.app.toggleCompleted('${list.id}')">
                <span class="material-icons completed-arrow" 
                      style="transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}">chevron_right</span>
                Completed (${completedTasks.length})
            </div>
         `;
         
         const completedContainer = document.createElement('div');
         completedContainer.className = `completed-tasks-container ${isExpanded ? 'open' : ''}`;
         completedContainer.id = `list-completed-${list.id}`;
         
         completedTasks.forEach(task => {
             const el = createTaskEl(task, list.task_color);
             el.classList.add('completed-task');
             completedContainer.appendChild(el);
         });
         
         completedSection.appendChild(completedContainer);
         listBody.appendChild(completedSection);
         
         if (!readOnly) {
             new Sortable(completedContainer, {
                 group: 'shared',
                 animation: 200,
                 ghostClass: 'sortable-ghost',
                 dragClass: 'sortable-drag',
                 onStart: (evt) => {
                     state.dragItem = { id: evt.item.dataset.id, type: 'task' };
                 },
                 onEnd: (evt) => {
                     handleTaskMove(evt);
                     setTimeout(() => state.dragItem = null, 100);
                 },
                 onAdd: (evt) => handleTaskDropState(evt, true)
             });
         }
     }

     listEl.appendChild(listBody);
     container.appendChild(listEl);

     if (!readOnly) {
         new Sortable(tasksContainer, {
             group: 'shared',
             animation: 200,
             ghostClass: 'sortable-ghost',
             dragClass: 'sortable-drag',
             delay: 0,
             onStart: (evt) => {
                 state.dragItem = { id: evt.item.dataset.id, type: 'task' };
             },
             onEnd: (evt) => {
                 handleTaskMove(evt);
                 setTimeout(() => state.dragItem = null, 100);
             },
             onAdd: (evt) => handleTaskDropState(evt, false)
         });
     }
}

function createTaskEl(task, taskColor = null) {
    const dateStr = task.due_date ? new Date(task.due_date).toLocaleDateString() : '';
    const el = document.createElement('div');
    el.className = 'task-card';
    el.dataset.id = task.id;
    if (taskColor) {
        el.style.backgroundColor = taskColor;
    }
    el.onclick = (e) => {
        if(!e.target.classList.contains('task-checkbox') && 
           !e.target.classList.contains('star-icon')) {
            window.app.openDetails(task.id);
        }
    };
    
    el.innerHTML = `
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
             onclick="window.app.toggleTaskStatus('${task.id}')"></div>
        <div class="task-info">
            <div class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
            ${task.description ? `<div class="task-desc-preview">${escapeHtml(task.description)}</div>` : ''}
            <div class="task-meta">
                ${dateStr ? `<div class="chip">${dateStr}</div>` : ''}
                ${task.recurrence ? `<span class="material-icons" style="font-size: 14px; color: var(--text-secondary);">update</span>` : ''}
            </div>
        </div>
        <span class="star-icon material-icons ${task.is_starred ? 'active' : ''}" 
              onclick="window.app.toggleStar('${task.id}')">
              ${task.is_starred ? 'star' : 'star_border'}
        </span>
    `;
    return el;
}

// --- ACTIONS EXPORTED ---
export function toggleCompleted(listId) {
    state.completedExpanded[listId] = !state.completedExpanded[listId];
    renderBoard();
}

export async function addTask(input, listId) {
    const title = input.value.trim();
    if(!title) return;
    input.value = '';
    const newTask = await api('/tasks', 'POST', { title, listId });
    if(newTask) {
        state.tasks.unshift(newTask);
        renderBoard();
    }
}

export async function toggleTaskStatus(id) {
    const task = state.tasks.find(t => t.id === id);
    const wasCompleted = task.completed;
    
    if (!wasCompleted && task.recurrence && task.due_date) {
        // Recurring Task Logic: Move to next date instead of completing
        const nextDate = calculateNextDueDate(task.due_date, task.recurrence);
        if (nextDate) {
            task.due_date = nextDate;
            renderBoard();
            await api(`/tasks/${id}`, 'PATCH', { due_date: nextDate });
            showToast(`Task rescheduled to ${new Date(nextDate).toLocaleDateString()}`);
            return;
        }
    }

    // Normal Completion
    task.completed = !wasCompleted;
    renderBoard(); 
    await api(`/tasks/${id}`, 'PATCH', { completed: task.completed });
}

export async function toggleStar(id) {
    const task = state.tasks.find(t => t.id === id);
    task.is_starred = !task.is_starred;
    renderBoard();
    await api(`/tasks/${id}`, 'PATCH', { is_starred: task.is_starred });
}

export async function createNewList() {
     if (state.currentView !== 'board' || !state.currentBoardId) {
         showToast("Switch to a Board to create a list.");
         return;
     }
     const title = await showModal({ title: "New List", placeholder: "List Name" });
     if(!title) return;
     const res = await api('/lists', 'POST', { title, boardId: state.currentBoardId });
     if (res.error) {
         showToast(res.error);
         return;
     }
     state.lists.push(res);
     renderBoard();
}

export async function createNewBoard() {
     const title = await showModal({ title: "New Board", placeholder: "Board Name" });
     if(!title) return;
     const res = await api('/boards', 'POST', { title });
     if (res.error) {
         showToast(res.error);
         return;
     }
     state.boards.push(res);
     switchBoard(res.id);
}

export async function renameList(id) {
    const list = state.lists.find(l => l.id === id);
    const newTitle = await showModal({ title: "Rename List", initialValue: list.title });
    if(newTitle && newTitle !== list.title) {
        list.title = newTitle;
        renderBoard();
        await api(`/lists/${id}`, 'PATCH', { title: newTitle });
    }
}

export async function deleteList(id) {
    const confirmed = await showModal({ title: "Delete this list?", showInput: false, confirmText: "Delete" });
    if(!confirmed) return;
    state.lists = state.lists.filter(l => l.id !== id);
    state.tasks = state.tasks.filter(t => t.list_id !== id);
    renderBoard();
    await api(`/lists/${id}`, 'DELETE');
}

// --- DRAG HANDLERS ---
function handleListReorder(evt) {
    const { newIndex, oldIndex } = evt;
    if (newIndex === oldIndex) return;
    
    // Sort logic is complex with filtered views, but assuming board view:
    // Update local state is tricky if we filtered.
    // For MVP: Fetch all again? Or just send backend patch.
    // Let's grab IDs from DOM.
    const itemEls = document.querySelectorAll('#boardContainer .list-column');
    const orderedIds = Array.from(itemEls).map(el => el.dataset.id);
    
    api('/lists/reorder', 'PATCH', { orderedIds });
}

function handleTaskMove(evt) {
    const { item, to, from, newIndex, oldIndex } = evt;
    if(newIndex === oldIndex && to === from) return;

    const taskId = item.dataset.id;
    const toListId = to.closest('.list-column').dataset.id;
    
    // Update State
    const task = state.tasks.find(t => t.id === taskId);
    task.list_id = toListId;

    // Get ordered IDs in target list (Active or Completed container)
    // NOTE: This only orders within that container. 
    // Ideally we need global order in list.
    // For now, simplify: just update list_id.
    
    api(`/tasks/${taskId}`, 'PATCH', { list_id: toListId });
    // Reorder call if needed
}

function handleTaskDropState(evt, isCompletedContainer) {
     const item = evt.item;
     const taskId = item.dataset.id;
     const task = state.tasks.find(t => t.id === taskId);
     
     if (task && task.completed !== isCompletedContainer) {
         console.log('Status change via drag');
         toggleTaskStatus(taskId); 
     }
}

// --- DETAILS ---
export function openDetails(id) {
    const task = state.tasks.find(t => t.id === id);
    state.activeTask = task;
    
    const panel = document.getElementById('detailsPanel');
    const list = state.lists.find(l => l.id === task.list_id);
    
    document.getElementById('detailsListName').textContent = list ? list.title : '';
    document.getElementById('detailsTitle').value = task.title;
    document.getElementById('detailsDesc').value = task.description || '';
    document.getElementById('detailsDate').value = task.due_date ? task.due_date.substring(0, 16) : '';
    
    // Handle split recurrence string
    const [type, value] = (task.recurrence || '').split(':');
    document.getElementById('detailsRecurrence').value = type || '';
    
    // UI Sync for Weekly
    document.querySelectorAll('.recurrence-day-chip').forEach(chip => {
        const day = chip.dataset.day;
        const activeDays = (type === 'weekly' && value) ? value.split(',') : [];
        chip.classList.toggle('active', activeDays.includes(day));
    });

    // UI Sync for Monthly (31-day grid)
    document.querySelectorAll('.recurrence-date-chip').forEach(chip => {
        const d = chip.dataset.date;
        const activeDates = (type === 'monthly' && value) ? value.split(',') : [];
        chip.classList.toggle('active', activeDates.includes(d));
    });

    // Yearly logic removed
    
    toggleRecurrenceDetails(true); // Sync visibility
    
    const check = document.getElementById('detailsCheck');
    check.className = `task-checkbox ${task.completed ? 'checked' : ''}`;
    check.onclick = () => { toggleTaskStatus(id); setTimeout(()=>openDetails(id), 50); }; 
    
    const star = document.getElementById('detailsStar');
    star.textContent = task.is_starred ? 'star' : 'star_border';
    star.className = `material-icons star-icon ${task.is_starred ? 'active' : ''}`;
    star.onclick = () => { toggleStar(id); setTimeout(()=>openDetails(id), 50); }; 
    
    ['detailsTitle', 'detailsDesc', 'detailsDate', 'detailsRecurrence'].forEach(eid => {
        const el = document.getElementById(eid);
        el.onblur = saveDetails;
    });

    panel.classList.add('open');
}

export function closeDetails() {
    document.getElementById('detailsPanel').classList.remove('open');
    state.activeTask = null;
}

async function saveDetails() {
    if(!state.activeTask) return;
    const t = state.activeTask;
    
    const title = document.getElementById('detailsTitle').value;
    const description = document.getElementById('detailsDesc').value;
    const date = document.getElementById('detailsDate').value;
    const recType = document.getElementById('detailsRecurrence').value;
    let recurrence = recType;

    if (recType === 'weekly') {
        const selected = Array.from(document.querySelectorAll('.recurrence-day-chip.active')).map(c => c.dataset.day);
        if (selected.length > 0) recurrence = `weekly:${selected.join(',')}`;
    } else if (recType === 'monthly') {
        const selected = Array.from(document.querySelectorAll('.recurrence-date-chip.active')).map(c => c.dataset.date);
        if (selected.length > 0) recurrence = `monthly:${selected.join(',')}`;
    }
    // Yearly removed
    
    if(t.title !== title || t.description !== description || t.due_date !== date || t.recurrence !== recurrence) {
        t.title = title;
        t.description = description;
        t.due_date = date || null; 
        t.recurrence = recurrence || null;
        
        renderBoard(); 
        await api(`/tasks/${t.id}`, 'PATCH', { 
            title: t.title, 
            description: t.description, 
            due_date: t.due_date, 
            recurrence: t.recurrence 
        });
    }
}

export function toggleRecurrenceDetails(skipAutoSave = false) {
    const val = document.getElementById('detailsRecurrence').value;
    document.getElementById('recurrenceDaysContainer').style.display = val === 'weekly' ? 'flex' : 'none';
    document.getElementById('recurrenceDateContainer').style.display = val === 'monthly' ? 'flex' : 'none';
    
    if (!skipAutoSave) saveDetails();
}

export async function deleteCurrentTask() {
    if(!state.activeTask) return;
    const confirmed = await showModal({ title: "Delete this task?", showInput: false, confirmText: "Delete" });
    if(!confirmed) return;
    const id = state.activeTask.id;
    state.tasks = state.tasks.filter(t => t.id !== id);
    renderBoard();
    closeDetails();
    await api(`/tasks/${id}`, 'DELETE');
}

// --- LIST OPTIONS MENU ---
export function showListMenu(listId, event) {
    event.stopPropagation();
    const list = state.lists.find(l => l.id === listId);
    let menu = document.getElementById('listOptionsMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'listOptionsMenu';
        menu.className = 'dropdown-menu';
        document.body.appendChild(menu);
    }

    const rect = event.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.right - 200}px`;

    const quickColors = ['', '#1a73e8', '#c5221f', '#f29900', '#188038', '#8e24aa', '#a142f4', '#00796b', '#3f51b5', '#455a64'];
 
    menu.innerHTML = `
        <div class="dropdown-section-title">Sort by</div>
        <div class="dropdown-item" onclick="window.app.sortList('${listId}', 'alpha')">
            <span class="material-icons">sort_by_alpha</span> Alphabetical
        </div>
        <div class="dropdown-item" onclick="window.app.sortList('${listId}', 'date')">
            <span class="material-icons">calendar_today</span> Due Date
        </div>
        <div class="dropdown-item" onclick="window.app.sortList('${listId}', 'starred')">
            <span class="material-icons">star</span> Starred
        </div>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-section-title">List Color Quick Select</div>
        <div class="color-picker-grid">
            ${quickColors.map(c => `
                <div class="color-circle ${list.color === c ? 'active' : ''}" 
                     style="background: ${c === '' ? 'var(--surface)' : c}; border: ${c === '' ? '1px solid var(--border)' : 'none'};" 
                     onclick="window.app.previewListColor('${listId}', '${c}', 'list', true)">
                     ${c === '' ? '<span class="material-icons" style="font-size:16px;color:var(--text-secondary)">block</span>' : ''}
                </div>
            `).join('')}
        </div>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-section-title">List Color</div>
        <div class="custom-color-picker">
            <input type="color" id="listColorPicker" value="${list.color || '#ffffff'}" 
                   oninput="window.app.previewListColor('${listId}', this.value, 'list', true)">
            <input type="text" id="listColorHex" class="custom-color-input" value="${list.color || ''}" placeholder="#HEXCODE"
                   oninput="window.app.previewListColor('${listId}', this.value, 'list', true)">
        </div>

        <div class="dropdown-section-title">Task Color Quick Select</div>
        <div class="color-picker-grid">
            ${quickColors.map(c => `
                <div class="color-circle ${list.task_color === c ? 'active' : ''}" 
                     style="background: ${c === '' ? 'var(--surface)' : c}; border: ${c === '' ? '1px solid var(--border)' : 'none'};" 
                     onclick="window.app.previewListColor('${listId}', '${c}', 'task', true)">
                     ${c === '' ? '<span class="material-icons" style="font-size:16px;color:var(--text-secondary)">block</span>' : ''}
                </div>
            `).join('')}
        </div>

        <div class="dropdown-section-title">Custom Task Color</div>
        <div class="custom-color-picker">
            <input type="color" id="taskColorPicker" value="${list.task_color || '#ffffff'}" 
                   oninput="window.app.previewListColor('${listId}', this.value, 'task', true)">
            <input type="text" id="taskColorHex" class="custom-color-input" value="${list.task_color || ''}" placeholder="#HEXCODE"
                   oninput="window.app.previewListColor('${listId}', this.value, 'task', true)">
        </div>
        
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" onclick="window.app.deleteCompletedTasks('${listId}')" style="color: #ea4335;">
            <span class="material-icons" style="color: inherit;">cleaning_services</span> Delete completed tasks
        </div>
        <div class="dropdown-item" onclick="window.app.deleteList('${listId}')" style="color: #ea4335;">
            <span class="material-icons" style="color: inherit;">delete</span> Delete list
        </div>
    `;

    menu.classList.add('active');

    const closeMenu = () => {
        menu.classList.remove('active');
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

export async function sortList(listId, criteria) {
    const listTasks = state.tasks.filter(t => t.list_id === listId);
    if (criteria === 'alpha') {
        listTasks.sort((a, b) => a.title.localeCompare(b.title));
    } else if (criteria === 'date') {
        listTasks.sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });
    } else if (criteria === 'starred') {
        listTasks.sort((a, b) => (b.is_starred ? 1 : 0) - (a.is_starred ? 1 : 0));
    }

    try {
        const orderedIds = listTasks.map(t => t.id);
        const data = await api('/tasks/reorder', 'PATCH', { orderedIds });
        if (!data) throw new Error('Failed to sort');
        
        state.tasks = state.tasks.map(t => {
            const index = orderedIds.indexOf(t.id);
            return index !== -1 ? { ...t, position: index } : t;
        });
        renderBoard();
        showToast(`Sorted by ${criteria}`);
    } catch (err) {
        showToast(err.message);
    }
}

export async function setListColor(listId, color, type = 'list', skipRender = false) {
    if (color === undefined || color === null) return;
    try {
        const normalizedColor = color === 'transparent' || color === '' ? null : color;
        const body = type === 'list' ? { color: normalizedColor } : { task_color: normalizedColor };
        
        const res = await api(`/lists/${listId}`, 'PATCH', body);
        if (res.error) throw new Error(res.error);
        
        state.lists = state.lists.map(l => l.id === listId ? res : l);
        if (!skipRender) renderBoard();
    } catch (err) {
        showToast(err.message);
    }
}

let colorSaveTimeout = null;
export function previewListColor(listId, color, type = 'list', autoSave = false) {
    const list = state.lists.find(l => l.id === listId);
    if (!list) return;

    // Sync UI components
    if (type === 'list') {
        const listEl = document.querySelector(`.list-column[data-id="${listId}"]`);
        if (listEl) listEl.style.backgroundColor = color || 'var(--surface)';
        
        const hexInput = document.getElementById('listColorHex');
        if (hexInput && document.activeElement !== hexInput) hexInput.value = color;
        
        const pickerInput = document.getElementById('listColorPicker');
        if (pickerInput && color.startsWith('#') && color.length === 7) pickerInput.value = color;
    } else {
        const tasks = document.querySelectorAll(`.list-column[data-id="${listId}"] .task-card`);
        tasks.forEach(t => t.style.backgroundColor = color || 'var(--surface)');
        
        const hexInput = document.getElementById('taskColorHex');
        if (hexInput && document.activeElement !== hexInput) hexInput.value = color;
        
        const pickerInput = document.getElementById('taskColorPicker');
        if (pickerInput && color.startsWith('#') && color.length === 7) pickerInput.value = color;
    }

    // Handle Auto-save
    if (autoSave) {
        clearTimeout(colorSaveTimeout);
        colorSaveTimeout = setTimeout(() => {
            // Only save if it's a valid color or null
            if (!color || color === 'transparent' || (color.startsWith('#') && (color.length === 7 || color.length === 4))) {
                setListColor(listId, color, type, true); // True = skipRender to avoid flickering
            }
        }, 800);
    }
}

export async function deleteCompletedTasks(listId) {
    const confirm = await showModal({
        title: 'Delete all completed tasks?',
        confirmText: 'Delete',
        showInput: false
    });
    if (!confirm) return;

    try {
        const res = await api(`/tasks/completed/${listId}`, 'DELETE');
        if (!res) throw new Error('Failed to delete completed tasks');
        
        state.tasks = state.tasks.filter(t => !(t.list_id === listId && t.completed));
        renderBoard();
        showToast('Completed tasks deleted');
    } catch (err) {
        showToast(err.message);
    }
}

// --- THEME & LAYOUT ---
export function initTheme() {
    const saved = localStorage.getItem('theme');
    document.body.classList.remove('dark-theme', 'light-theme');
    
    if (saved === 'dark') {
        document.body.classList.add('dark-theme');
        updateThemeIcon(true);
    } else if (saved === 'light') {
        document.body.classList.add('light-theme');
        updateThemeIcon(false);
    } else {
        const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        updateThemeIcon(isSystemDark);
    }
    renderLayoutClasses();
}

export function toggleTheme() {
    let isDark = document.body.classList.contains('dark-theme');
    if (!isDark && !document.body.classList.contains('light-theme')) {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        updateThemeIcon(false);
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        updateThemeIcon(true);
    }
}

function updateThemeIcon(isDark) {
    document.getElementById('themeIcon').textContent = isDark ? 'light_mode' : 'dark_mode';
}

export function toggleLayout() {
    state.layout = state.layout === 'horizontal' ? 'vertical' : 'horizontal';
    localStorage.setItem('layout', state.layout);
    renderLayoutClasses();
    renderLayoutIcon();
}

function renderLayoutClasses() {
    const container = document.getElementById('boardContainer');
    if (state.layout === 'vertical') {
        container.classList.add('vertical-view');
    } else {
        container.classList.remove('vertical-view');
    }
}

function renderLayoutIcon() {
    const icon = document.getElementById('layoutIcon');
    icon.textContent = state.layout === 'horizontal' ? 'view_agenda' : 'view_column'; 
}

// --- IMPORT ---
export function triggerImport() {
    document.getElementById('importInput').click();
}

export async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!state.currentBoardId) {
        showToast("Please select or create a board first.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            console.log("Importing data:", data);

            if (data.kind === "tasks#tasks") {
                // Single list
                const listTitle = data.title || file.name.replace('.json', '');
                await importList(listTitle, data.items);
                showToast("Import completed!");
            } else if (data.kind === "tasks#taskLists" && Array.isArray(data.items)) {
                // Full Google Takeout: Multiple task lists
                for (const listData of data.items) {
                    if (listData.items) {
                        await importList(listData.title, listData.items);
                    }
                }
                showToast("Import of " + data.items.length + " lists completed!");
            } else if (Array.isArray(data.items)) {
                // Fallback for simple array of items
                const listTitle = data.title || file.name.replace('.json', '');
                await importList(listTitle, data.items);
                showToast("Import completed!");
            } else {
                showToast("Unrecognized Google Tasks JSON format.");
            }
            
            setTimeout(() => window.location.reload(), 1000); 
        } catch (err) {
            console.error("Import error:", err);
            showToast("Failed to parse JSON file.");
        }
    };
    reader.readAsText(file);
}

async function importList(title, items) {
    if (!items || !Array.isArray(items)) return;

    // 1. Create List
    const listRes = await api('/lists', 'POST', { title, boardId: state.currentBoardId });
    if (!listRes) return;

    // 2. Prepare Tasks
    const tasksToImport = items.map(item => ({
        title: item.title,
        listId: listRes.id,
        description: item.notes || item.description, // Google uses 'notes'
        due_date: item.due || item.due_date,
        completed: item.status === 'completed' || !!item.completed,
        is_starred: !!item.starred || !!item.is_starred
    }));

    // 3. Bulk Insert
    await api('/tasks/bulk', 'POST', { tasks: tasksToImport });
}

// --- ACTIONS FOR HTML ---
export const actions = {
    setView,
    switchBoard,
    createNewList,
    createNewBoard,
    toggleLayout,
    toggleTheme,
    triggerImport,
    handleImport,
    showListMenu,
    sortList,
    setListColor,
    previewListColor,
    deleteCompletedTasks,
    renameList,
    deleteList,
    toggleCompleted,
    addTask,
    saveDetails,
    toggleTaskStatus,
    toggleRecurrenceDetails,
    toggleDrawer: () => {
         const d = document.getElementById('drawer');
         d.classList.toggle('closed');
    },
    showBoardMenu,
    renameBoardFromMenu,
    changeBoardBackgroundColorFromMenu,
    changeBoardImageUrlFromMenu,
    triggerBoardBackgroundImageUpload,
    handleBoardBackgroundImageUpload,
    deleteBoardFromMenu,
    applyBoardBackground,
    previewBoardBackground,
    setBoardBackground
};
