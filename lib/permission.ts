import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access'

export const statement = {
    ...defaultStatements,
    manager: [
        'create',
        'list',
        'set-role',
        'ban',
        'impersonate',
        'delete',
        'set-password'
    ], // <-- Permissions available for created roles
    user: ['set-password']
} as const

export const ac = createAccessControl(statement)

export const user = ac.newRole({
    user: ['set-password']
})

export const admin = ac.newRole({
    manager: [
        'create',
        'list',
        'set-role',
        'ban',
        'impersonate',
        'delete',
        'set-password'
    ]
    // ...adminAc.statements
})

export const agent = ac.newRole({
    manager: ['create', 'list', 'ban', 'impersonate'],
    user: ['set-password']
})
