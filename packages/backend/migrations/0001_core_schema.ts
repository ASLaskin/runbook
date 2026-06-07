import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.text('source').notNullable()
    t.text('subject').notNullable()
    t.text('body').notNullable()
    t.text('requester').notNullable()
    t.text('status').notNullable().defaultTo('received')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('runs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('request_id').notNullable().references('id').inTable('requests').onDelete('CASCADE')
    t.text('thread_id').notNullable()
    t.text('status').notNullable().defaultTo('running')
    t.text('category')
    t.text('priority')
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('ended_at', { useTz: true })
    t.index('request_id')
    t.index('status')
  })

  await knex.schema.createTable('run_steps', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('run_id').notNullable().references('id').inTable('runs').onDelete('CASCADE')
    t.integer('seq').notNullable()
    t.text('kind').notNullable() // node, llm, or tool
    t.text('name').notNullable()
    t.text('status').notNullable().defaultTo('ok')
    t.jsonb('input')
    t.jsonb('output')
    t.integer('tokens_in')
    t.integer('tokens_out')
    t.integer('latency_ms')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['run_id', 'seq'])
  })

  await knex.schema.createTable('approvals', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('run_id').notNullable().references('id').inTable('runs').onDelete('CASCADE')
    t.text('node').notNullable()
    t.jsonb('proposed_action').notNullable()
    t.text('decision').notNullable().defaultTo('pending') // pending | approved | edited | rejected
    t.jsonb('edited_payload')
    t.text('reason')
    t.text('decided_by')
    t.timestamp('decided_at', { useTz: true })
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index('run_id')
    t.index('decision')
  })

  await knex.schema.createTable('audit', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('run_id').references('id').inTable('runs').onDelete('SET NULL')
    t.text('actor').notNullable()
    t.text('action').notNullable()
    t.jsonb('before')
    t.jsonb('after')
    t.timestamp('at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.index('run_id')
  })

  await knex.schema.createTable('outbox', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('aggregate_id').notNullable()
    t.text('type').notNullable()
    t.jsonb('payload').notNullable()
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('published_at', { useTz: true })
  })

  await knex.raw(
    'CREATE INDEX outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL',
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('outbox')
  await knex.schema.dropTableIfExists('audit')
  await knex.schema.dropTableIfExists('approvals')
  await knex.schema.dropTableIfExists('run_steps')
  await knex.schema.dropTableIfExists('runs')
  await knex.schema.dropTableIfExists('requests')
}
