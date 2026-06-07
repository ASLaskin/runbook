import { fileURLToPath } from 'node:url'
import { Cause, Console, Data, Effect, Exit, Option } from 'effect'
import knexFactory, { type Knex } from 'knex'
import { loadDotEnv } from '../config/config'

const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url))
const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url))

class MigrateError extends Data.TaggedError('MigrateError')<{ readonly reason: string }> {}

const toError = (cause: unknown): MigrateError =>
  new MigrateError({ reason: cause instanceof Error ? cause.message : String(cause) })

const knexResource = Effect.acquireRelease(
  Effect.suspend(() => {
    const databaseUrl = process.env.DATABASE_URL
    return databaseUrl === undefined
      ? Effect.fail(new MigrateError({ reason: 'DATABASE_URL is not set' }))
      : Effect.succeed(
          knexFactory({
            client: 'pg',
            connection: databaseUrl,
            migrations: { directory: migrationsDir, loadExtensions: ['.ts'] },
          }),
        )
  }),
  (db) => Effect.promise(() => db.destroy()),
)

const commands = (db: Knex): Record<string, Effect.Effect<void, MigrateError>> => ({
  latest: Effect.tryPromise({ try: () => db.migrate.latest(), catch: toError }).pipe(
    Effect.flatMap(([, applied]) =>
      Console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Already up to date'),
    ),
  ),
  rollback: Effect.tryPromise({ try: () => db.migrate.rollback(), catch: toError }).pipe(
    Effect.flatMap(([, reverted]) =>
      Console.log(
        reverted.length > 0 ? `Rolled back: ${reverted.join(', ')}` : 'Nothing to roll back',
      ),
    ),
  ),
  status: Effect.tryPromise({ try: () => db.migrate.currentVersion(), catch: toError }).pipe(
    Effect.flatMap((version) => Console.log(`Current migration version: ${version}`)),
  ),
})

const program = Effect.gen(function* () {
  yield* loadDotEnv(envPath)
  const command = process.argv[2] ?? 'latest'
  const db = yield* knexResource
  const handler = commands(db)[command]
  if (handler === undefined) {
    return yield* new MigrateError({
      reason: `Unknown command: ${command} (use latest | rollback | status)`,
    })
  }
  yield* handler
})

const exit = await Effect.runPromiseExit(Effect.scoped(program))

if (Exit.isFailure(exit)) {
  const failure = Cause.failureOption(exit.cause)
  console.error(Option.isSome(failure) ? failure.value.reason : Cause.pretty(exit.cause))
  process.exitCode = 1
}
