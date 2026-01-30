const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Executes a function within a MongoDB transaction with automatic retries for TransientTransactionErrors.
 * @param {Function} fn - The async function containing DB operations. Receives `session` as an argument.
 * @returns {Promise<any>} - The result of the function.
 */
async function withTransaction(fn) {
    const session = await mongoose.startSession();
    
    try {
        let result;
        await session.withTransaction(async () => {
            result = await fn(session);
        });
        return result;
    } catch (err) {
        // pino-http or the global error handler will catch this, 
        // but we log specifically for transaction failures.
        if (err.name === 'MongoServerError' && err.hasErrorLabel('TransientTransactionError')) {
            logger.warn({ err }, 'TransientTransactionError detected. Transaction should have retried.');
        }
        throw err;
    } finally {
        session.endSession();
    }
}

module.exports = { withTransaction };
