const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, require('../config/validateEnv').JWT_SECRET);
        
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role || 'user'
        };
        
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
