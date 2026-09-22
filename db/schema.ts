import { sql } from 'drizzle-orm'
import {
    sqliteTable,
    integer,
    text,
    real,
    uniqueIndex,
    primaryKey
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

export const tags = sqliteTable('tags', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tag: text('tag').notNull().unique(),
    color: text('color').default('#6b7280'),
    isActive: integer('is_active').notNull().default(1)
})

export const tagsRelations = relations(tags, ({ many }) => ({
    customerTags: many(customerTags)
}))

export const customerTags = sqliteTable(
    'customer_tags',
    {
        customerId: integer('customer_id')
            .notNull()
            .references(() => customers.id, { onDelete: 'cascade' }),
        tagId: integer('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' })
    },
    (table) => [primaryKey({ columns: [table.customerId, table.tagId] })]
)

export const customerTagsRelations = relations(customerTags, ({ one }) => ({
    customer: one(customers, {
        fields: [customerTags.customerId],
        references: [customers.id]
    }),
    tag: one(tags, {
        fields: [customerTags.tagId],
        references: [tags.id]
    })
}))

export const customerNotes = sqliteTable('customer_notes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    userId: text('user_id').references(() => user.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    )
})

export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
    customer: one(customers, {
        fields: [customerNotes.customerId],
        references: [customers.id]
    }),
    user: one(user, {
        fields: [customerNotes.userId],
        references: [user.id]
    })
}))

export const customerTasks = sqliteTable('customer_tasks', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    urgency: text('urgency', { enum: ['low', 'medium', 'high'] })
        .notNull()
        .default('medium'),
    isCompleted: integer('is_completed', { mode: 'boolean' })
        .notNull()
        .default(false),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    userId: text('user_id').references(() => user.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    )
})

export const customerTasksRelations = relations(customerTasks, ({ one }) => ({
    customer: one(customers, {
        fields: [customerTasks.customerId],
        references: [customers.id]
    }),
    user: one(user, {
        fields: [customerTasks.userId],
        references: [user.id]
    })
}))

export const customerEvents = sqliteTable('customer_events', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['videollamada', 'charla', 'presencial'] })
        .notNull()
        .default('charla'),
    title: text('title'),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
    status: text('status', { enum: ['pending', 'attended', 'no_show'] })
        .notNull()
        .default('pending'),
    meetingLink: text('meeting_link'),
    userId: text('user_id').references(() => user.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    )
})

export const customerEventsRelations = relations(customerEvents, ({ one }) => ({
    customer: one(customers, {
        fields: [customerEvents.customerId],
        references: [customers.id]
    }),
    user: one(user, {
        fields: [customerEvents.userId],
        references: [user.id]
    })
}))

export const quotationSettings = sqliteTable('quotation_settings', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyName: text('company_name').notNull().default('S Travel Costa Rica'),
    logo: text('logo'),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    email: text('email'),
    website: text('website'),
    facebook: text('facebook'),
    instagram: text('instagram'),
    address: text('address'),
    terms: text('terms'),
    advisorName: text('advisor_name'),
    advisorEmail: text('advisor_email'),
    currency: text('currency').notNull().default('EUR'),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationPrograms = sqliteTable('quotation_programs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    includes: text('includes'),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationSchools = sqliteTable('quotation_schools', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    logo: text('logo'),
    website: text('website'),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationSchedules = sqliteTable('quotation_schedules', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationCourses = sqliteTable('quotation_courses', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    programId: integer('program_id').references(() => quotationPrograms.id),
    schoolId: integer('school_id').references(() => quotationSchools.id),
    name: text('name').notNull(),
    description: text('description'),
    weeks: real('weeks').notNull().default(1),
    scheduleId: integer('schedule_id').references(() => quotationSchedules.id),
    hoursPerWeek: real('hours_per_week').notNull().default(15),
    priceCents: integer('price_cents').notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationAccommodations = sqliteTable(
    'quotation_accommodations',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        name: text('name').notNull(),
        type: text('type').notNull().default('Residencia estudiantil'),
        description: text('description'),
        pricePerWeekCents: integer('price_per_week_cents').notNull().default(0),
        currency: text('currency').notNull().default('EUR'),
        minWeeks: real('min_weeks'),
        maxWeeks: real('max_weeks'),
        isActive: integer('is_active').notNull().default(1),
        createdAt: integer('created_at', { mode: 'timestamp' }).default(
            sql`(unixepoch())`
        ),
        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .default(sql`(unixepoch())`)
            .$onUpdate(() => new Date())
    }
)

export const quotationExtras = sqliteTable('quotation_extras', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    priceCents: integer('price_cents').notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    priceType: text('price_type', { enum: ['fixed', 'variable'] })
        .notNull()
        .default('fixed'),
    application: text('application'),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationDiscounts = sqliteTable('quotation_discounts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['percent', 'fixed'] })
        .notNull()
        .default('fixed'),
    value: real('value').notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    startsAt: integer('starts_at', { mode: 'timestamp' }),
    endsAt: integer('ends_at', { mode: 'timestamp' }),
    isActive: integer('is_active').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotations = sqliteTable('quotations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    number: text('number').notNull().unique(),
    customerId: integer('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'cascade' }),
    status: text('status', {
        enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'canceled']
    })
        .notNull()
        .default('draft'),
    currency: text('currency').notNull().default('EUR'),
    issueDate: integer('issue_date', { mode: 'timestamp' }),
    validUntil: integer('valid_until', { mode: 'timestamp' }),
    advisorId: text('advisor_id').references(() => user.id),
    advisorName: text('advisor_name'),
    advisorEmail: text('advisor_email'),
    clientName: text('client_name').notNull(),
    clientPhone: text('client_phone'),
    clientEmail: text('client_email'),
    clientCountry: text('client_country'),
    programId: integer('program_id'),
    programName: text('program_name'),
    courseId: integer('course_id'),
    schoolId: integer('school_id'),
    schoolName: text('school_name'),
    courseName: text('course_name'),
    scheduleName: text('schedule_name'),
    weeks: real('weeks'),
    hoursPerWeek: real('hours_per_week'),
    coursePriceCents: integer('course_price_cents'),
    accommodationIncluded: integer('accommodation_included', {
        mode: 'boolean'
    })
        .notNull()
        .default(false),
    accommodationId: integer('accommodation_id'),
    accommodationName: text('accommodation_name'),
    accommodationType: text('accommodation_type'),
    accommodationWeeks: real('accommodation_weeks'),
    accommodationPricePerWeekCents: integer(
        'accommodation_price_per_week_cents'
    ),
    courseTotalCents: integer('course_total_cents').notNull().default(0),
    accommodationTotalCents: integer('accommodation_total_cents')
        .notNull()
        .default(0),
    extrasTotalCents: integer('extras_total_cents').notNull().default(0),
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    discountTotalCents: integer('discount_total_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    data: text('data'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date())
})

export const quotationItems = sqliteTable('quotation_items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    quotationId: integer('quotation_id')
        .notNull()
        .references(() => quotations.id, { onDelete: 'cascade' }),
    kind: text('kind', {
        enum: ['course', 'accommodation', 'extra', 'discount']
    }).notNull(),
    label: text('label').notNull(),
    description: text('description'),
    quantity: real('quantity'),
    unitPriceCents: integer('unit_price_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    sortOrder: integer('sort_order').notNull().default(0),
    sourceType: text('source_type'),
    sourceId: integer('source_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
        sql`(unixepoch())`
    )
})

export const quotationRelations = relations(quotations, ({ one, many }) => ({
    customer: one(customers, {
        fields: [quotations.customerId],
        references: [customers.id]
    }),
    advisor: one(user, {
        fields: [quotations.advisorId],
        references: [user.id]
    }),
    items: many(quotationItems)
}))

export const quotationItemsRelations = relations(
    quotationItems,
    ({ one }) => ({
        quotation: one(quotations, {
            fields: [quotationItems.quotationId],
            references: [quotations.id]
        })
    })
)

export const customers = sqliteTable('customers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    travelTime: text('travel_time').notNull(),
    country: text('country'),
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
    logs: many(logs),
    customerTags: many(customerTags),
    notes: many(customerNotes),
    tasks: many(customerTasks),
    events: many(customerEvents),
    quotations: many(quotations)
}))
