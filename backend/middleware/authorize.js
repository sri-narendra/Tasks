const logger = require('../config/logger');

// Generic authorization middleware
// Strategies:
// 1. Resource ID in Params (e.g., GET /boards/:id)
// 2. Resource ID in Body (e.g., POST /lists -> boardId)

const authorize = (Model, options = {}) => async (req, res, next) => {
    const { 
        source = 'params', // 'params' | 'body' | 'query'
        key = 'id', 
        parent = false // If true, we are checking a parent resource (validating creation permission)
    } = options;

    try {
        const resourceId = req[source][key];

        if (!resourceId) {
            // If optional and missing, maybe skip? For now, enforcing strictness.
            return res.status(400).json({ error: `Missing ${key} in ${source}` });
        }

        const query = { 
            _id: resourceId, 
            user_id: req.user.id,
            deleted_at: null 
        };

        const doc = await Model.findOne(query);

        if (!doc) {
            logger.warn(
                { userId: req.user.id, resourceId, model: Model.modelName }, 
                `⛔ Access Denied: User attempted to access ${Model.modelName}`
            );
            return res.status(404).json({ error: 'Resource not found' }); // Use 404 to prevent enumeration
        }

        // Attach to request for reuse (avoid double DB hit)
        if (!req.resources) req.resources = {};
        req.resources[Model.modelName.toLowerCase()] = doc;

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = authorize;
