import { sql } from 'drizzle-orm'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { user } from '@/auth-schema'

export const status = sqliteTable('status', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    status: text('status').notNull().unique(),
    color: text('color').default('#6b7280'),
    isActive: integer('is_active').notNull().default(1)
})

export const priority = sqliteTable('priority', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    priority: text('priority').notNull().unique(),
    color: text('color').default('#6b7280'),
    isActive: integer('is_active').notNull().default(1)
})

export const customers = sqliteTable('customers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    travelTime: text('travel_time').notNull(),
    statusId: integer('status_id')
        .references(() => status.id)
        .notNull()
        .default(1),
    priorityId: integer('priority_id')
        .references(() => priority.id)
        .notNull()
        .default(1),
    assignedTo: text('assigned_to')
        .references(() => user.id)
        .notNull()
        .default('0vd84cJDrYloFlFJRdErhuztO9J9jwaI'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})
