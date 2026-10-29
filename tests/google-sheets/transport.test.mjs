import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAppsScriptUrl, postToAppsScript } from '../../lib/integrations/google-sheets-transport.ts'
const url = 'https://script.google.com/macros/s/deployment/exec'
const payload = { protocol: 2, secret: 'private-secret', organizationId: 'org-a', action: 'upsert', version: 7, lead: { id: 'org-a:customer:1' } }
const success = { ok: true, protocol: 2, organizationId: 'org-a', action: 'upsert', version: 7, id: payload.lead.id, applied: true }

test('only deployment exec URLs are accepted', () => {
    assert.equal(normalizeAppsScriptUrl(url), url)
    for (const value of ['http://script.google.com/macros/s/x/exec', 'https://evil.test/exec', url+'?secret=x', 'https://u:p@script.google.com/macros/s/x/exec', 'https://script.google.com:444/macros/s/x/exec']) assert.throws(() => normalizeAppsScriptUrl(value))
})
test('validates application result, organization, ID, version and action', async t => {
    for (const result of [{ok:true}, {...success, action:'ping'}, {...success, version:6}, {...success, organizationId:'org-b'}, {...success, applied:undefined}]) {
        t.mock.method(globalThis, 'fetch', async () => Response.json(result))
        await assert.rejects(postToAppsScript(url, payload))
        t.mock.restoreAll()
    }
    t.mock.method(globalThis, 'fetch', async () => Response.json(success))
    assert.equal((await postToAppsScript(url, payload)).applied, true)
})
test('response errors cannot reflect secrets', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({...success, ok:false, error:payload.secret}))
    await assert.rejects(postToAppsScript(url,payload), error => !error.message.includes(payload.secret))
})
test('Google response redirect uses GET without the secret', async t => {
    const requests = []
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        requests.push({url:String(url), ...init})
        return requests.length === 1 ? new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo?key=x'}}) : Response.json(success)
    })
    await postToAppsScript(url, payload)
    assert.equal(requests[1].method, 'GET')
    assert.equal(requests[1].body, undefined)
})
test('redirect to another host is rejected without making a second request', async t => {
    let calls=0
    t.mock.method(globalThis,'fetch', async () => {calls++;return new Response(null,{status:302,headers:{location:'https://evil.test/'}})})
    await assert.rejects(postToAppsScript(url,payload))
    assert.equal(calls,1)
})
test('deadline includes reading a stalled response body', async t => {
    t.mock.method(globalThis,'fetch', async (_, init) => new Response(new ReadableStream({start(controller) {
        init.signal.addEventListener('abort', () => controller.error(new Error('aborted')))
    }})))
    await assert.rejects(postToAppsScript(url,payload,Date.now()+30), /tiempo/)
})
