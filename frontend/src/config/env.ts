import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url({ message: 'VITE_API_BASE_URL must be a valid URL' }),
  VITE_USE_MOCK_API: z.enum(['true', 'false']).optional().default('false'),
  VITE_APP_NAME: z.string().optional().default('ACES Zone'),
});

function validateEnv() {
  const parsed = envSchema.safeParse(import.meta.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, val]) => `  ${key}: ${val?.join(', ')}`)
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${messages}\n\n` +
        'Copy .env.example to .env and fill in the required values.'
    );
  }

  return parsed.data;
}

export const env = validateEnv();
