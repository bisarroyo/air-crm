require('./load.cjs')
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const email = require('../../lib/cotizaciones/email.ts')
const { defaultDraft } = require('../../lib/cotizaciones/shared.ts')
const company = {
    companyName: 'S Travel',
    email: 'empresa@example.com',
    phone: '+506 1234',
    whatsapp: '+506 5678',
    website: 'https://stravel.example',
    address: 'Costa Rica',
    currency: 'EUR'
}
const context = {
    number: 'COT-001',
    clientName: 'Ana <script>alert(1)</script>',
    clientEmail: 'lead@example.com',
    programName: 'Inglés & cultura',
    advisorName: 'Asesor',
    advisorEmail: 'asesor@example.com',
    company
}

test('formal templates interpolate program/client and HTML escapes all user/company values', () => {
    const template = email.DEFAULT_QUOTATION_EMAIL_SETTINGS.templates[0]
    const result = email.renderQuotationEmail(template.subject, template.message, context)
    assert.match(result.subject, /Inglés & cultura/)
    assert.match(result.html, /Ana &lt;script&gt;/)
    assert.ok(!result.html.includes('<script>'))
    for (const text of [
        'Asesor',
        'asesor@example.com',
        'empresa@example.com',
        'Costa Rica',
        'COT-001'
    ])
        assert.ok(result.html.includes(text))
    assert.ok(!result.text.includes('{{'))
})
test('recipients normalize duplicates, validate limits and honor copy checkbox', () => {
    assert.deepEqual(
        email.quotationEmailRecipients(
            'a@example.com,A@example.com;b@example.com',
            false,
            null
        ),
        { to: ['a@example.com', 'b@example.com'], cc: [] }
    )
    assert.deepEqual(
        email.quotationEmailRecipients('a@example.com', true, company.email).cc,
        [company.email]
    )
    assert.deepEqual(
        email.quotationEmailRecipients(company.email, true, company.email).cc,
        []
    )
    assert.ok(email.quotationEmailRecipients('bad', false, company.email).error)
    assert.ok(email.quotationEmailRecipients('a@example.com', true, null).error)
    assert.ok(
        email.quotationEmailRecipients(
            Array(11)
                .fill(0)
                .map((_, i) => `u${i}@example.com`)
                .join(','),
            false,
            null
        ).error
    )
})
test('settings allow deleting all templates, reject dangling defaults, invalid variables and header injection', () => {
    assert.equal(
        email.validateEmailSettings(email.DEFAULT_QUOTATION_EMAIL_SETTINGS),
        null
    )
    assert.equal(
        email.validateEmailSettings({
            copyCompany: false,
            templates: [],
            defaultTemplateId: null
        }),
        null
    )
    assert.ok(
        email.validateEmailSettings({
            copyCompany: false,
            templates: [],
            defaultTemplateId: 'deleted'
        })
    )
    assert.ok(email.validateMessage('Subject\r\nBcc: other@example.com', 'message'))
    assert.ok(email.validateMessage('Subject', '{{unknown}}'))
})
function loadModule(relative, mocks) {
    const filename = path.resolve(relative)
    const loaded = new Module(filename, module)
    loaded.filename = filename
    loaded.paths = module.paths
    loaded.require = (specifier) => {
        if (specifier in mocks) return mocks[specifier]
        if (specifier.startsWith('@/')) return require(path.resolve(specifier.slice(2)))
        if (specifier.startsWith('./'))
            return require(path.resolve(path.dirname(filename), specifier))
        return require(specifier)
    }
    loaded._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true
            }
        }).outputText,
        filename
    )
    return loaded.exports
}
function setup(overrides = {}) {
    const tables = {
        customers: { email: 'customer.email' },
        quotations: {
            id: 'quotation.id',
            customerId: 'quotation.customerId',
            status: 'quotation.status'
        },
        quotationEmailDeliveries: { id: 'delivery.id' },
        quotationEmailSettings: { id: 'settings.id' }
    }
    const state = {
        sends: [],
        updates: [],
        deliveries: new Map(),
        session: {
            user: {
                id: 'advisor',
                role: 'user',
                name: 'Asesor',
                email: 'asesor@example.com'
            }
        },
        allowed: true,
        smtp: true,
        ...overrides
    }
    const draft = {
        ...defaultDraft(
            { name: 'Ana', email: 'old@example.com' },
            { name: 'Asesor', email: 'asesor@example.com' },
            'EUR'
        ),
        company
    }
    const row = {
        id: 1,
        customerId: 2,
        number: 'COT-001',
        status: 'draft',
        advisorId: 'advisor',
        data: JSON.stringify(draft)
    }
    const db = {
        select: () => ({
            from: (table) => ({
                where: (condition) => ({
                    limit: async () =>
                        table === tables.quotations
                            ? [row]
                            : table === tables.customers
                              ? [{ email: 'lead@example.com' }]
                              : table === tables.quotationEmailSettings
                                ? []
                                : [state.deliveries.get(condition.value)].filter(Boolean)
                })
            })
        }),
        insert: (table) => ({
            values: (value) => ({
                onConflictDoNothing: () => ({
                    returning: async () => {
                        if (state.deliveries.has(value.id)) return []
                        state.deliveries.set(value.id, value)
                        return [value]
                    }
                }),
                onConflictDoUpdate: async () => {
                    state.settings = value
                }
            })
        }),
        update: (table) => ({
            set: (values) => ({
                where: (condition) => {
                    const perform = async () => {
                        if (state.persistenceFailure) throw new Error('database failed')
                        state.updates.push({ table, values })
                        if (table === tables.quotationEmailDeliveries)
                            Object.assign(state.deliveries.get(condition.value), values)
                        return [{ status: values.status }]
                    }
                    return {
                        then: (resolve, reject) => perform().then(resolve, reject),
                        returning: perform
                    }
                }
            })
        })
    }
    const mocks = {
        'next/server': { NextResponse: Response },
        'next/headers': { headers: async () => new Headers() },
        'drizzle-orm': {
            eq: (column, value) => ({ column, value }),
            and: (...conditions) => conditions
        },
        '@/lib/auth': { auth: { api: { getSession: async () => state.session } } },
        '@/db': { db },
        '@/db/schema': tables,
        '@/lib/cotizaciones/quotation': {
            canManageQuotation: () => state.allowed,
            parseQuotationData: () => draft,
            snapshotCompany: async () => company
        },
        '@/lib/cotizaciones/email-settings': {
            getQuotationEmailSettings: async () => {
                if (state.settingsFailure) throw state.settingsFailure
                return email.DEFAULT_QUOTATION_EMAIL_SETTINGS
            }
        },
        '@/lib/cotizaciones/pdf': {
            buildQuotationPdf: async (data, number) => {
                assert.equal(data, draft)
                assert.equal(number, row.number)
                return Buffer.from('%PDF-quotation')
            }
        },
        '@/lib/email/smtp': {
            isSmtpConfigured: () => state.smtp,
            senderAddress: () => ({ name: 'SMTP Sender', address: 'sender@example.com' }),
            SmtpNotConfiguredError: class extends Error {},
            getTransporter: () => ({
                sendMail: async (payload) => {
                    state.sends.push(payload)
                    if (state.fail) throw new Error('SMTP secret failure')
                    return (
                        state.result || {
                            accepted: [...payload.to, ...payload.cc],
                            rejected: [],
                            messageId: 'provider-1'
                        }
                    )
                }
            })
        }
    }
    return {
        state,
        tables,
        mocks,
        route: loadModule(
            'app/api/customers/[id]/quotations/[quotationId]/email/route.ts',
            mocks
        )
    }
}
const params = { params: Promise.resolve({ id: '2', quotationId: '1' }) }
const body = {
    requestId: 'request-1234567890',
    to: 'lead@example.com',
    copyCompany: true,
    subject: 'Cotización {{numero}}',
    message: 'Estimado/a {{cliente}}: adjuntamos su cotización.'
}
const request = (data) =>
    new Request('http://localhost/api/quotation/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
test('GET loads current lead email, settings and provider status without sending', async () => {
    const { route, state } = setup()
    const response = await route.GET(new Request('http://localhost'), params)
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.context.clientEmail, 'lead@example.com')
    assert.equal(data.smtpConfigured, true)
    assert.equal(state.sends.length, 0)
})
test('send attaches saved PDF, uses advisor reply-to, CC and only marks sent after provider success', async () => {
    const { route, state, tables } = setup()
    const response = await route.POST(request(body), params)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).success, true)
    const payload = state.sends[0]
    assert.equal(payload.replyTo, 'asesor@example.com')
    assert.deepEqual(payload.cc, [company.email])
    assert.equal(payload.bcc, undefined)
    assert.equal(payload.attachments[0].content.toString(), '%PDF-quotation')
    assert.equal(payload.attachments[0].contentType, 'application/pdf')
    assert.ok(
        state.updates.some(
            (update) =>
                update.table === tables.quotations && update.values.status === 'sent'
        )
    )
    await route.POST(request(body), params)
    assert.equal(state.sends.length, 1)
})
test('copy unchecked excludes company and all inherited BCC', async () => {
    const { route, state } = setup()
    await route.POST(request({ ...body, copyCompany: false }), params)
    assert.deepEqual(state.sends[0].cc, [])
    assert.equal(state.sends[0].bcc, undefined)
})
test('auth, authorization and invalid input prevent SMTP side effects', async () => {
    for (const [overrides, code] of [
        [{ session: null }, 401],
        [{ allowed: false }, 403],
        [{ smtp: false }, 503]
    ]) {
        const { route, state } = setup(overrides)
        assert.equal((await route.POST(request(body), params)).status, code)
        assert.equal(state.sends.length, 0)
    }
    const { route, state } = setup()
    assert.equal((await route.POST(request({ ...body, to: 'bad' }), params)).status, 400)
    assert.equal(state.sends.length, 0)
})
test('provider rejection and partial acceptance never mark quotation sent or expose secrets', async () => {
    const { route, state, tables } = setup({ fail: true })
    const response = await route.POST(request(body), params)
    assert.equal(response.status, 502)
    assert.ok(!(await response.text()).includes('secret'))
    assert.ok(!state.updates.some((update) => update.table === tables.quotations))
    const partial = setup({
        result: {
            accepted: [company.email],
            rejected: ['lead@example.com'],
            messageId: 'partial'
        }
    })
    const result = await partial.route.POST(request(body), params)
    assert.equal((await result.json()).partial, true)
    assert.ok(
        !partial.state.updates.some(
            (update) => update.table === partial.tables.quotations
        )
    )
})
test('settings permit authenticated reads but only administrators can write', async () => {
    const { mocks, state } = setup()
    const route = loadModule('app/api/admin/quotation-email-settings/route.ts', mocks)
    assert.equal((await route.GET()).status, 200)
    assert.equal(
        (await route.PUT(request(email.DEFAULT_QUOTATION_EMAIL_SETTINGS))).status,
        403
    )
    state.session.user.role = 'admin'
    assert.equal(
        (
            await route.PUT(
                request({ copyCompany: false, templates: [], defaultTemplateId: null })
            )
        ).status,
        200
    )
    assert.equal(JSON.parse(state.settings.templates).length, 0)
})

test('SMTP acceptance followed by persistence failure does not claim a confirmed sent status', async () => {
    const { route, state } = setup({ persistenceFailure: true })
    const response = await route.POST(request(body), params)
    const result = await response.json()
    assert.equal(result.success, true)
    assert.ok(result.warning)
    assert.equal(result.quotationStatus, undefined)
    assert.equal(state.sends.length, 1)
    assert.equal((await route.POST(request(body), params)).status, 409)
    assert.equal(state.sends.length, 1)
})

const { readQuotationEmailResponse } = require('../../lib/cotizaciones/email-response.ts')
test('empty, HTML, null and truncated responses show a useful error instead of JSON syntax errors', async () => {
    for (const response of [
        new Response('', {status:500}),
        new Response('<html>Bad gateway</html>', {status:502}),
        new Response('{', {status:200}),
        Response.json(null),
        Response.json([])
    ]) {
        await assert.rejects(readQuotationEmailResponse(response, 'No se pudo preparar el correo'), error =>
            error.message.includes('No se pudo preparar el correo') && !error.message.includes('Unexpected'))
    }
    await assert.rejects(readQuotationEmailResponse(Response.json({error:'No autorizado'}, {status:401}), 'fallback'), /No autorizado/)
    assert.deepEqual(await readQuotationEmailResponse(Response.json({success:true}), 'fallback'), {success:true})
})
test('missing migration returns JSON for both opening and sending, without SMTP side effects', async () => {
    const failure = new Error('Failed query with private parameters', {cause:new Error('SQLITE_ERROR: no such table: quotation_email_settings')})
    const {route,state,mocks} = setup({settingsFailure:failure})
    for (const response of [await route.GET(new Request('http://localhost'),params), await route.POST(request(body),params)]) {
        assert.equal(response.status,503)
        assert.equal((await response.json()).code,'EMAIL_SCHEMA_MISSING')
    }
    const settings = loadModule('app/api/admin/quotation-email-settings/route.ts',mocks)
    assert.equal((await settings.GET()).status,503)
    assert.equal(state.sends.length,0)
})
test('unexpected preparation failure returns safe JSON, not raw database details', async () => {
    const {route,state} = setup({settingsFailure:new Error('private connection token')})
    const response = await route.GET(new Request('http://localhost'),params)
    assert.equal(response.status,500)
    const body = await response.json()
    assert.equal(body.code,'QUOTATION_EMAIL_ERROR')
    assert.ok(!JSON.stringify(body).includes('private connection token'))
    assert.equal(state.sends.length,0)
})
