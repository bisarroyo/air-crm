#!/usr/bin/env node
/**
 * Crea la organización inicial del CRM, agrega como miembros a los usuarios
 * existentes y, opcionalmente, asigna los leads anteriores sin organización.
 *
 * Es idempotente: se puede ejecutar varias veces sin duplicar la organización,
 * los miembros ni reasignar leads que ya tienen propietario.
 *
 * Uso:
 *   node --env-file=.env scripts/bootstrap-organization.mjs \
 *     --name "S Travel Costa Rica" --slug "s-travel-costa-rica" --claim-legacy
 *
 * `--claim-legacy` asigna TODOS los registros con organization_id NULL a esta
 * organización. Usarlo solo cuando el despliegue tiene una única empresa: los
 * leads anteriores no guardan de qué organización eran.
 */
import { randomBytes } from 'node:crypto'
import { createClient } from '@libsql/client'

function flag(name, fallback) {
    const index = process.argv.indexOf(name)
    if (index === -1) return fallback
    return process.argv[index + 1] ?? fallback
}

const url = process.env.DATABASE_URL?.trim()
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim()
if (!url) {
    console.error('Falta DATABASE_URL. Ejecutá con: node --env-file=.env scripts/bootstrap-organization.mjs')
    process.exit(1)
}

const name = flag('--name', 'S Travel Costa Rica')
const slug = flag('--slug', 's-travel-costa-rica')
const claimLegacy = process.argv.includes('--claim-legacy')
const client = createClient({ url, authToken })

function id() {
    return randomBytes(16).toString('hex')
}

try {
    const now = Date.now()

    const existing = await client.execute({
        sql: 'SELECT id, name, slug FROM organization WHERE slug = ? OR name = ? LIMIT 1',
        args: [slug, name]
    })
    let organizationId = existing.rows[0]?.id

    if (organizationId) {
        console.log(`Organización existente: ${existing.rows[0].name} (${organizationId})`)
    } else {
        organizationId = id()
        await client.execute({
            sql: 'INSERT INTO organization (id, name, slug, created_at) VALUES (?, ?, ?, ?)',
            args: [organizationId, name, slug, now]
        })
        console.log(`Organización creada: ${name} (${organizationId})`)
    }

    const users = await client.execute('SELECT id, email, role FROM user')
    let addedMembers = 0
    for (const user of users.rows) {
        if (user.role === 'pending') continue

        const current = await client.execute({
            sql: 'SELECT id FROM member WHERE organization_id = ? AND user_id = ? LIMIT 1',
            args: [organizationId, user.id]
        })
        if (current.rows.length > 0) continue

        // Global CRM admins manage the integration; everyone else only needs
        // access to the organization's leads.
        const role = user.role === 'admin' ? 'owner' : 'member'
        await client.execute({
            sql: 'INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
            args: [id(), organizationId, user.id, role, now]
        })
        addedMembers++
        console.log(`  + ${user.email} (${role})`)
    }
    console.log(`Miembros agregados: ${addedMembers}`)

    if (claimLegacy) {
        const customers = await client.execute({
            sql: 'UPDATE customers SET organization_id = ? WHERE organization_id IS NULL',
            args: [organizationId]
        })
        const travelLeads = await client.execute({
            sql: 'UPDATE travel_leads SET organization_id = ? WHERE organization_id IS NULL',
            args: [organizationId]
        })
        console.log(`Leads asignados: ${customers.rowsAffected} customers, ${travelLeads.rowsAffected} travel`)
    } else {
        const [customers, travelLeads] = await Promise.all([
            client.execute('SELECT count(*) AS n FROM customers WHERE organization_id IS NULL'),
            client.execute('SELECT count(*) AS n FROM travel_leads WHERE organization_id IS NULL')
        ])
        console.log(`Leads sin organización (sin tocar): ${customers.rows[0].n} customers, ${travelLeads.rows[0].n} travel`)
        console.log('Agregá --claim-legacy para asignarlos a esta organización.')
    }

    // Existing sessions keep their own active organization in the session row.
    // Set it when it is empty so the next request already sees the data.
    await client.execute({
        sql: `UPDATE session SET active_organization_id = ?
              WHERE user_id IN (SELECT user_id FROM member WHERE organization_id = ?)
                AND (active_organization_id IS NULL OR active_organization_id = '')`,
        args: [organizationId, organizationId]
    })

    console.log('')
    console.log(`PUBLIC_LEADS_ORGANIZATION_ID=${organizationId}`)
    console.log('Agregá esa variable al .env del servidor para el formulario público.')
} finally {
    await client.close()
}
