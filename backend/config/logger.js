const pino = require('pino');
const env = require('./validateEnv');

const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password', 
      'req.body.token',
      'req.body.refreshToken', 
      'user.password'
    ],
    remove: true,
  },
  base: {
    env: env.NODE_ENV,
  },
});

module.exports = logger;
