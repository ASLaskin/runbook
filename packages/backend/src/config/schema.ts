import { z } from 'zod'

export const EnvSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    LLM_MODE: z.enum(['mock', 'real']).default('mock'),
    ANTHROPIC_API_KEY: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((env) => env.LLM_MODE !== 'real' || !!env.ANTHROPIC_API_KEY, {
    message: 'ANTHROPIC_API_KEY is required when LLM_MODE=real',
    path: ['ANTHROPIC_API_KEY'],
  })

export type AppConfig = z.infer<typeof EnvSchema>
