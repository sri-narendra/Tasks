const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

// Explicitly load .env from backend root if not already loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also try standard location just in case
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  MONGODB_URI: z.string().url("Invalid MongoDB URI"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  CORS_ORIGIN: z.string().default('http://localhost:5173'), 
  ALLOWED_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

console.log('🔍 Validating environment variables...');

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error('❌ CRTICAL ERROR: Invalid environment variables');
  console.error(JSON.stringify(env.error.format(), null, 2));
  process.exit(1);
}

console.log('✅ Environment variables valid');

module.exports = env.data;
