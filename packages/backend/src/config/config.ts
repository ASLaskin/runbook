import { Context, Data, Effect, Layer } from 'effect'
import type { z } from 'zod'
import { EnvSchema, type AppConfig } from './schema'

export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly issues: string
}> {}

export class AppConfigService extends Context.Tag('@runbook/backend/Config')<
  AppConfigService,
  AppConfig
>() {}

const formatZodIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')

export const loadDotEnv = (path?: string): Effect.Effect<void> => {
  const source = path ?? '.env'
  return Effect.try(() =>
    path === undefined ? process.loadEnvFile() : process.loadEnvFile(path),
  ).pipe(
    Effect.matchEffect({
      onSuccess: () => Effect.logInfo(`Loaded environment from ${source}`),
      onFailure: () => Effect.logInfo(`No ${source} file found — using ambient environment`),
    }),
  )
}

export const ConfigLive = Layer.effect(
  AppConfigService,
  Effect.gen(function* () {
    const parsed = EnvSchema.safeParse(process.env)
    if (!parsed.success) {
      return yield* new ConfigError({ issues: formatZodIssues(parsed.error) })
    }
    return parsed.data
  }),
)
