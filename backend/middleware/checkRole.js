const checkRole = (roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(req.user.role)) {
        return res.status(403).json({ error: 'Permission denied: Insufficient role' });
    }
    
    next();
};

module.exports = checkRole;
