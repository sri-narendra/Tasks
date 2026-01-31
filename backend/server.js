const env = require('./config/validateEnv');
require('./config/logger');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');

// Models & Middleware
const { User, Board, List, Task, Attachment } = require('./models');
const auth = require('./middleware/auth');
const authorize = require('./middleware/authorize');
// Schemas
const Schemas = require('./validation/schemas');
// Controllers
const authController = require('./controllers/authController');

// Helper wrapper for schema validation if not extracted
const validateSchema = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        if (err.constructor.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation Error', details: err.errors });
        }
        next(err);
    }
};

const app = express();
const port = env.PORT;

// --- DB Connection ---
mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
}).then(() => logger.info('✅ Connected to MongoDB'))
  .catch(err => {
      logger.fatal({ err }, '❌ MongoDB connection error');
      process.exit(1);
  });

// --- Middleware ---
// --- Middleware & Safety ---
app.use(helmet({ 
    contentSecurityPolicy: { 
        directives: { 
            defaultSrc: ["'self'"], 
            scriptSrc: ["'self'"], 
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], 
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        } 
    } 
}));

// Request ID propagation
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || req.id || require('crypto').randomUUID();
    res.setHeader('X-Request-Id', requestId);
    next();
});

app.use(pinoHttp({ 
    logger,
    genReqId: (req) => req.headers['x-request-id'] || require('crypto').randomUUID()
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(cors({
    origin: (origin, callback) => {
        const allowed = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) : [];
        const strippedOrigin = origin ? origin.replace(/\/$/, '') : null;
        
        if (!origin || allowed.includes(strippedOrigin) || env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            logger.warn({ origin, allowed }, 'CORS Blocked');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// --- Rate Limiting ---
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 auth requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login/register attempts. Please try again after 15 minutes.' },
    skipSuccessfulRequests: true // Don't count successful logins against the limit
});

// Apply global limit
app.use('/api/', globalLimiter);
// Apply strict auth limits
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// --- ROUTES ---

// Auth
app.post('/api/auth/register', authLimiter, validateSchema(Schemas.RegisterSchema), authController.register);
app.post('/api/auth/login', authLimiter, validateSchema(Schemas.LoginSchema), authController.login);
app.post('/api/auth/refresh', authController.refreshToken);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user })); // Keep for frontend check

// Protected Routes
app.use('/api', auth); 

// Boards
app.get('/api/boards', async (req, res, next) => {
    try {
        const boards = await Board.find({ user_id: req.user.id, deleted_at: null }).sort({ created_at: 1 });
        res.json(boards);
    } catch (err) { next(err); }
});

app.post('/api/boards', validateSchema(Schemas.BoardSchema), async (req, res, next) => {
    try {
        const board = new Board({ ...req.body, user_id: req.user.id });
        await board.save();
        res.status(201).json(board);
    } catch (err) { next(err); }
});

app.patch('/api/boards/:id', 
    validateSchema(Schemas.UpdateBoardSchema), 
    authorize(Board), 
    async (req, res, next) => {
        try {
            const board = await Board.findOneAndUpdate(
                { _id: req.params.id }, 
                req.body, 
                { new: true }
            );
            res.json(board);
        } catch (err) { next(err); }
});

app.delete('/api/boards/:id', authorize(Board), async (req, res, next) => {
    try {
        // Soft Delete
        const board = await Board.findOneAndUpdate({ _id: req.params.id }, { deleted_at: new Date() });
        // Cascade Soft Delete?
        await List.updateMany({ board_id: req.params.id }, { deleted_at: new Date() });
        await Task.updateMany({ list_id: { $in: (await List.find({ board_id: req.params.id })).map(l => l._id) } }, { deleted_at: new Date() });
        res.json({ success: true });
    } catch (err) { next(err); }
});

// Lists
app.get('/api/lists', async (req, res, next) => {
    try {
        const { boardId } = req.query;
        // Verify Board access if boardId provided? 
        // Technically strict authorization requires checking boardId access first.
        if (boardId) {
             const board = await Board.findOne({ _id: boardId, user_id: req.user.id, deleted_at: null });
             if (!board) return res.status(404).json({ error: 'Board not found' });
        }
        const lists = await List.find({ user_id: req.user.id, deleted_at: null, ...(boardId && { board_id: boardId }) }).sort({ position: 1 });
        res.json(lists);
    } catch (err) { next(err); }
});

app.post('/api/lists', 
    validateSchema(Schemas.ListSchema), 
    authorize(Board, { source: 'body', key: 'boardId', parent: true }), 
    async (req, res, next) => {
        try {
            const list = new List({ ...req.body, board_id: req.body.boardId, user_id: req.user.id });
            await list.save();
            res.status(201).json(list);
        } catch (err) { next(err); }
});

app.patch('/api/lists/reorder', validateSchema(Schemas.ReorderSchema), async (req, res, next) => {
    try {
        // Reorder usually implies ownership of all. 
        // We'll trust the user_id query in update for now, or check all.
        // Simplest: `await List.count(...)`
        const { orderedIds } = req.body;
        const count = await List.countDocuments({ _id: { $in: orderedIds }, user_id: req.user.id, deleted_at: null });
        if (count !== orderedIds.length) return res.status(403).json({ error: 'Access denied' });
        
        await Promise.all(orderedIds.map((id, index) => 
            List.findOneAndUpdate({ _id: id }, { position: index })
        ));
        res.json({ success: true });
    } catch (err) { next(err); }
});

app.patch('/api/lists/:id', validateSchema(Schemas.UpdateListSchema), authorize(List), async (req, res, next) => {
    try {
        const list = await List.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });
        res.json(list);
    } catch (err) { next(err); }
});

app.delete('/api/lists/:id', authorize(List), async (req, res, next) => {
    try {
        await List.findOneAndUpdate({ _id: req.params.id }, { deleted_at: new Date() });
        await Task.updateMany({ list_id: req.params.id }, { deleted_at: new Date() });
        res.json({ success: true });
    } catch (err) { next(err); }
});

// Tasks
app.get('/api/tasks', async (req, res, next) => {
    try {
        const { listId } = req.query;
        if(listId) {
            const list = await List.findOne({ _id: listId, user_id: req.user.id, deleted_at: null });
            if(!list) return res.status(404).json({error:'List not found'});
        }
        const tasks = await Task.find({ user_id: req.user.id, deleted_at: null, ...(listId && { list_id: listId }) }).sort({ position: 1 });
        res.json(tasks);
    } catch (err) { next(err); }
});

app.post('/api/tasks', 
    validateSchema(Schemas.TaskSchema), 
    authorize(List, { source: 'body', key: 'listId', parent: true }),
    async (req, res, next) => {
        try {
            // Also authorize parent task if subtask
            if (req.body.parent_id) {
                const parent = await Task.findOne({ _id: req.body.parent_id, user_id: req.user.id, deleted_at: null });
                if (!parent) return res.status(404).json({ error: 'Parent task not found' });
            }
            const task = new Task({ ...req.body, list_id: req.body.listId, user_id: req.user.id, completed_at: req.body.completed ? new Date() : null });
            await task.save();
            res.status(201).json(task);
        } catch (err) { next(err); }
});

app.patch('/api/tasks/:id', validateSchema(Schemas.UpdateTaskSchema), authorize(Task), async (req, res, next) => {
    try {
        const updates = req.body;
        if (updates.completed === true) updates.completed_at = new Date();
        else if (updates.completed === false) updates.completed_at = null;
        const task = await Task.findOneAndUpdate({ _id: req.params.id }, updates, { new: true });
        res.json(task);
    } catch (err) { next(err); }
});

app.delete('/api/tasks/:id', authorize(Task), async (req, res, next) => {
    try {
        await Task.findOneAndUpdate({ _id: req.params.id }, { deleted_at: new Date() });
        res.json({ success: true });
    } catch (err) { next(err); }
});

// Attachments
app.post('/api/attachments', 
    validateSchema(Schemas.AttachmentSchema), 
    authorize(Task, { source: 'body', key: 'taskId', parent: true }),
    async (req, res, next) => {
        try {
             // Attachment is a bit different, request body keys need mapping
             const { taskId, fileName, fileUrl, fileType } = req.body;
             const att = new Attachment({ task_id: taskId, user_id: req.user.id, file_name: fileName, file_url: fileUrl, file_type: fileType });
             await att.save();
             res.status(201).json(att);
        } catch (err) { next(err); }
});

app.get('/api/attachments/:taskId', 
    authorize(Task, { source: 'params', key: 'taskId', parent: true }), // Reuse authorize to check parent task access
    async (req, res, next) => {
        try {
            const atts = await Attachment.find({ task_id: req.params.taskId, user_id: req.user.id, deleted_at: null });
            res.json(atts);
        } catch (err) { next(err); }
});

app.delete('/api/attachments/:id', authorize(Attachment), async (req, res, next) => {
    try {
        await Attachment.findOneAndUpdate({_id: req.params.id}, { deleted_at: new Date() });
         res.json({ success: true });
    } catch(err){ next(err); }
});

// Health (Improved)
app.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        env: env.NODE_ENV,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Soft check: return 200 even if DB is blipping, but log it
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        health.db = dbStatus;
        if (dbStatus !== 'connected') {
            logger.warn({ dbStatus }, 'Health check: Database is not connected');
        }
        res.json(health);
    } catch (err) {
        logger.error({ err }, 'Health check failed');
        // Return 200 to prevent Render from reboot-looping healthy instances
        res.status(200).json({ ...health, status: 'degraded', error: err.message });
    }
});

// Error Handler
app.use((err, req, res, next) => {
    logger.error({ err }, 'Request Failed');
    if (env.NODE_ENV === 'production') res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    else res.status(err.status || 500).json({ error: err.message, stack: err.stack });
});

const server = app.listen(port, () => logger.info(`🚀 Server running on ${port}`));

// HTTP keep-alive timeouts (Render Load Balancer Affinity)
server.keepAliveTimeout = 65000; 
server.headersTimeout = 66000;

// Socket Tracking for Graceful Shutdown
const connections = new Set();
server.on('connection', (socket) => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
});

// Shutdown Handler
const gracefulShutdown = (signal) => {
    logger.info({ signal }, 'Received shutdown signal. Starting graceful drain...');
    
    // 1. Stop accepting new connections
    server.close(() => {
        logger.info('HTTP server closed. Finalizing DB connections...');
        mongoose.connection.close(false, () => {
            logger.info('Database connections closed. Exiting process.');
            process.exit(0);
        });
    });

    // 2. Destroy idle sockets after a grace period
    setTimeout(() => {
        logger.warn(`Shutdown timeout reached. Force-closing ${connections.size} active connections.`);
        for (const socket of connections) {
            socket.destroy();
        }
    }, 10000); // 10s grace period
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => { 
    logger.fatal({ err }, 'Unhandled Rejection - Crashing for safety'); 
    process.exit(1);
});
process.on('uncaughtException', (err) => { 
    logger.fatal({ err }, 'Uncaught Exception - Crashing for safety'); 
    process.exit(1);
});

