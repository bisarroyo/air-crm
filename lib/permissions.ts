import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access'

const statement = {
    ...defaultStatements,
    customer: ['list', 'create', 'update', 'delete'],
    referral: ['list', 'create', 'update', 'delete'],
    lead: ['create', 'list']
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
    customer: ['list', 'create', 'update', 'delete'],
    referral: ['list', 'create', 'update', 'delete'],
    lead: ['create', 'list'],
    ...adminAc.statements
})

export const ref = ac.newRole({
    customer: ['list'],
    lead: ['create', 'list']
})

export const user = ac.newRole({})
