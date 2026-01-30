const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, RefreshToken, Board, List } = require('../models');
const env = require('../config/validateEnv');
const logger = require('../config/logger');
const { withTransaction } = require('../utils/transaction');

// Helpers
const generateRefreshToken = (user, ip) => {
    return new Promise((resolve, reject) => {
        const token = crypto.randomBytes(40).toString('hex');
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Hash token before storage so DB leaks don't compromise sessions
        // Using fast hash (SHA256) since high entropy random string
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const refreshToken = new RefreshToken({
            user: user._id,
            tokenHash,
            expires,
            createdByIp: ip
        });

        refreshToken.save()
            .then(() => resolve({ token, expires })) // Return raw token to user
            .catch(reject);
    });
};

const setTokenCookie = (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: env.NODE_ENV === 'production', 
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        sameSite: 'strict', // CSRF protection helper
        path: '/api/auth' // Scope cookie to auth routes only
    };
    res.cookie('refreshToken', token, cookieOptions);
};

// Controllers
exports.register = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'User already exists' });

        const hashed = await bcrypt.hash(password, 12);

        const result = await withTransaction(async (session) => {
            // DB WRITES ONLY inside transaction
            const user = new User({ email, password: hashed, role: 'user' });
            await user.save({ session });

            const board = new Board({ 
                title: 'Main Board', 
                user_id: user._id,
                background: '#1a73e8' 
            });
            await board.save({ session });

            const list = new List({ 
                title: 'To Do', 
                board_id: board._id, 
                user_id: user._id 
            });
            await list.save({ session });

            return { user, board };
        });

        const { user } = result;

        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const { token: refreshToken } = await generateRefreshToken(user, req.ip);
        setTokenCookie(res, refreshToken);

        logger.info({ userId: user.id, event: 'register_success' }, 'User registered with default board');
        res.status(201).json({ 
            token: jwtToken, 
            user: { id: user.id, email: user.email, role: user.role } 
        });
    } catch (err) {
        logger.error({ err, event: 'register_failure', email: req.body.email }, 'Registration failed');
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        // Timing Safe check (always hash even if user not found - simplified here)
        // Ideally: if (!user) await bcrypt.compare(password, dummyHash) ...
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const { token: refreshToken } = await generateRefreshToken(user, req.ip);
        setTokenCookie(res, refreshToken);

        logger.info({ userId: user.id }, 'User logged in');
        res.json({ 
            token: jwtToken, 
            user: { id: user.id, email: user.email, role: user.role } 
        });
    } catch (err) {
        next(err);
    }
};

exports.refreshToken = async (req, res, next) => {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'Token required' });

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        // Find token (ignoring revoked for a moment to check for reuse)
        const rToken = await RefreshToken.findOne({ tokenHash }).populate('user');
        
        if (!rToken) {
            // Token literally doesn't exist? Client has garbage or old deleted token.
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Reuse Detection
        if (rToken.revoked) {
            // CRITICAL SECURITY EVENT: Revoked token used!
            // Revoke ALL tokens for this user family
            logger.warn({ userId: rToken.user.id, ip: req.ip }, '♻️ REUSE DETECTED! Revoking all sessions.');
            await RefreshToken.updateMany(
                { user: rToken.user.id },
                { revoked: Date.now(), revokedByIp: req.ip, replacedByToken: 'REUSE_VIOLATION' }
            );
            return res.status(403).json({ error: 'Security violation - Session revoked' });
        }

        if (new Date() > rToken.expires) {
            return res.status(401).json({ error: 'Token expired' });
        }

        // Rotation
        const { token: newRefToken, expires } = await generateRefreshToken(rToken.user, req.ip);
        
        rToken.revoked = Date.now();
        rToken.revokedByIp = req.ip;
        rToken.replacedByToken = crypto.createHash('sha256').update(newRefToken).digest('hex'); // Track chain
        await rToken.save();

        setTokenCookie(res, newRefToken);

        // Issue new JWT
        const jwtToken = jwt.sign(
            { userId: rToken.user.id, email: rToken.user.email, role: rToken.user.role },
            env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ token: jwtToken });

    } catch (err) {
        next(err);
    }
};

exports.logout = async (req, res, next) => {
    const token = req.cookies.refreshToken;
    if (token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await RefreshToken.findOneAndUpdate(
            { tokenHash },
            { revoked: Date.now(), revokedByIp: req.ip }
        );
    }
    // Clear cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ message: 'Logged out' });
};
