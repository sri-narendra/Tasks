require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- ROUTES ---

// 1. Boards
app.get('/boards', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/boards', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const { data, error } = await supabase.from('boards').insert([{ title }]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, background } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (background !== undefined) updates.background = background;
    
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const { data, error } = await supabase.from('boards').update(updates).eq('id', id).select().single();
    if (error) {
      console.error('Update board failed:', error);
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('boards').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Lists
app.get('/lists', async (req, res) => {
  try {
    const { boardId } = req.query;
    let query = supabase.from('lists').select('*').order('position', { ascending: true }).order('created_at', { ascending: true });
    if (boardId) query = query.eq('board_id', boardId);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/lists', async (req, res) => {
  try {
    const { title, boardId } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const row = { title };
    if (boardId) row.board_id = boardId;
    const { data, error } = await supabase.from('lists').insert([row]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/lists/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!orderedIds) return res.status(400).json({ error: 'Ids required' });
    await Promise.all(orderedIds.map((id, index) => supabase.from('lists').update({ position: index }).eq('id', id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, boardId, color, task_color } = req.body;
    const updateData = {};
    if (title) updateData.title = title;
    if (boardId) updateData.board_id = boardId;
    if (color !== undefined) updateData.color = color;
    if (task_color !== undefined) updateData.task_color = task_color;
    
    if (Object.keys(updateData).length === 0) return res.status(400).json({error: 'Nothing to update'});

    const { data, error } = await supabase.from('lists').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/lists/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('lists').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Tasks
app.get('/tasks', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tasks').select('*').order('position', { ascending: true }).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const { title, listId, description, due_date, completed, is_starred, position } = req.body;
    if (!title || !listId) return res.status(400).json({ error: 'Title/ListId required' });
    
    const row = { 
      title, 
      list_id: listId,
      description: description || null,
      due_date: due_date || null,
      completed: !!completed,
      is_starred: !!is_starred,
      position: position || 0,
      recurrence: req.body.recurrence || null,
      completed_at: !!completed ? new Date().toISOString() : null
    };

    const { data, error } = await supabase.from('tasks').insert([row]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tasks/bulk', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ error: 'Tasks array required' });
    
    const rows = tasks.map(t => ({
      title: t.title,
      list_id: t.listId,
      description: t.description || null,
      due_date: t.due_date || null,
      completed: !!t.completed,
      is_starred: !!t.is_starred,
      position: t.position || 0,
      recurrence: t.recurrence || null,
      completed_at: !!t.completed ? new Date().toISOString() : null
    }));

    const { data, error } = await supabase.from('tasks').insert(rows).select();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/tasks/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!orderedIds) return res.status(400).json({ error: 'Ids required' });
    await Promise.all(orderedIds.map((id, index) => supabase.from('tasks').update({ position: index }).eq('id', id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    if (updates.completed === true) {
      updates.completed_at = new Date().toISOString();
    } else if (updates.completed === false) {
      updates.completed_at = null;
    }
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/tasks/completed/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const { error } = await supabase.from('tasks').delete().eq('list_id', listId).eq('completed', true);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- STATIC SERVING FOR DEPLOYMENT ---
// Serve files from the parent directory (root of the repo)
app.use(express.static(path.join(__dirname, '../')));

// Catch-all to serve index.html for non-API routes (if we had client-side routing, but good as fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
