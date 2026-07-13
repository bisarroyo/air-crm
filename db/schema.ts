import { sql } from 'drizzle-orm'
import {
    sqliteTable,
    integer,
    text,
    uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
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

export const logs = sqliteTable('logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    changes: text('changes'),
    userId: text('user_id').references(() => user.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    )
})

export const logsRelations = relations(logs, ({ one }) => ({
    customer: one(customers, {
        fields: [logs.customerId],
        references: [customers.id]
    }),
    user: one(user, {
        fields: [logs.userId],
        references: [user.id]
    })
}))

export const referrals = sqliteTable(
    'referrals',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        code: text('code').notNull().unique(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        name: text('name'),
        createdAt: integer('created_at', { mode: 'timestamp' }).default(
            sql`(unixepoch())`
        )
    },
    (table) => [uniqueIndex('referrals_code_uidx').on(table.code)]
)

export const referralsRelations = relations(referrals, ({ one, many }) => ({
    user: one(user, {
        fields: [referrals.userId],
        references: [user.id]
    }),
    customers: many(customers)
}))

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
    referralId: integer('referral_id').references(() => referrals.id),
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

export const customersRelations = relations(customers, ({ one, many }) => ({
    referral: one(referrals, {
        fields: [customers.referralId],
        references: [referrals.id]
    }),
    logs: many(logs)
}))
