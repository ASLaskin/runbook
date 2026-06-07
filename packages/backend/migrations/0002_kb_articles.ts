import type { Knex } from 'knex'

const EMBEDDING_DIM = 384

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector')

  await knex.schema.createTable('kb_articles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.text('title').notNullable()
    t.text('body').notNullable()
    t.specificType('embedding', `vector(${EMBEDDING_DIM})`)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw(
    'CREATE INDEX kb_articles_embedding_idx ON kb_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)',
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('kb_articles')
}
