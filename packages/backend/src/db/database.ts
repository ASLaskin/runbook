import { Context, Data, Effect, Layer } from 'effect'
import knexFactory, { type Knex } from 'knex'
import { AppConfigService } from '../config/config'

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly operation: string
  readonly cause: unknown
}> {}

export interface DatabaseService {
  readonly knex: Knex
  readonly execute: <A>(
    operation: string,
    run: (knex: Knex) => PromiseLike<A>,
  ) => Effect.Effect<A, DatabaseError>
}

export class Database extends Context.Tag('@runbook/backend/Database')<
  Database,
  DatabaseService
>() {}

const makeKnex = (connectionString: string): Knex =>
  knexFactory({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 10 },
  })

export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const config = yield* AppConfigService

    const knex = yield* Effect.acquireRelease(
      Effect.sync(() => makeKnex(config.DATABASE_URL)),
      (k) =>
        Effect.promise(() => k.destroy()).pipe(
          Effect.andThen(Effect.logInfo('Database pool closed')),
        ),
    )

    yield* Effect.tryPromise({
      try: () => knex.raw('select 1'),
      catch: (cause) => new DatabaseError({ operation: 'connect', cause }),
    })
    yield* Effect.logInfo('Database pool ready')

    const execute: DatabaseService['execute'] = (operation, run) =>
      Effect.tryPromise({
        try: () => Promise.resolve(run(knex)),
        catch: (cause) => new DatabaseError({ operation, cause }),
      })

    return { knex, execute }
  }),
)
