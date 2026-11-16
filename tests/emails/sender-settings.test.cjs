const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks) {
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText
    const module = { exports: {} }
    new Function('require', 'module', 'exports', source)((name) => {
        if (name in mocks) return mocks[name]
        return require(name)
    }, module, module.exports)
    return module.exports
}

test('settings API enforces permissions, validates names and persists the trimmed value', async () => {
    let session = null
    let saved = 'Original'
    const api = load('app/api/emails/settings/route.ts', {
        'next/headers': { headers: async () => ({}) },
        '@/lib/auth': { auth: { api: { getSession: async () => session } } },
        '@/db/schema': { emailSenderSettings: { id: 'id' } },
        '@/db': { db: { insert: () => ({ values: (value) => ({ onConflictDoUpdate: async () => { saved = value.fromName } }) }) } },
        '@/lib/email/sender-settings': { getEmailSenderSettings: async () => ({ fromName: saved, fromAddress: 'sender@example.com' }) }
    })
    const put = (body) => api.PUT(new Request('http://localhost/api/emails/settings', {
        method: 'PUT', body: JSON.stringify(body)
    }))
    assert.equal((await api.GET()).status, 401)
    assert.equal((await put({ fromName: 'New' })).status, 401)
    session = { user: { role: 'user' } }
    assert.equal((await put({ fromName: 'New' })).status, 403)
    assert.equal((await (await api.GET()).json()).canEdit, false)
    session.user.role = 'admin'
    for (const fromName of ['', '   ', 'a'.repeat(121), 'Name\r\nBcc: victim@example.com', 123]) {
        assert.equal((await put({ fromName })).status, 400)
        assert.equal(saved, 'Original')
    }
    assert.equal((await put({ fromName: '  Bismark Arroyo de S Travel  ' })).status, 200)
    assert.equal((await (await api.GET()).json()).fromName, 'Bismark Arroyo de S Travel')
})

test('sender resolves the saved name on each send and keeps the SMTP address', async () => {
    const previous = { ...process.env }
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.com', SMTP_USER: 'sender@example.com', SMTP_PASS: 'test', SMTP_FROM_ADDRESS: 'sender@example.com', SMTP_FROM_NAME: 'Old name' })
    let name = 'Bismark Arroyo de S Travel'
    try {
        const smtp = load('lib/email/smtp.ts', {
            './sender-settings': { getEmailSenderSettings: async () => ({ fromName: name }) }
        })
        assert.deepEqual(await smtp.senderAddress(), { name, address: 'sender@example.com' })
        name = 'Nuevo nombre'
        assert.deepEqual(await smtp.senderAddress(), { name, address: 'sender@example.com' })
    } finally {
        process.env = previous
    }
})
