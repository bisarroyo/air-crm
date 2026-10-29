import test from 'node:test'
import assert from 'node:assert/strict'
import {database,service} from './fixture.mjs'

const insert=(db,org,name='Name',statusId=1)=>db.execute({sql:"INSERT INTO customers(organization_id,name,phone,email,travel_time,assigned_to,status_id) VALUES (?, ?, '001', '', '0', 'u', ?) RETURNING id",args:[org,name,statusId]})
const insertTravel=(db,org,name='Travel')=>db.execute({sql:"INSERT INTO travel_leads(organization_id,name,phone,email,status_id) VALUES (?, ?, '002', '', 1) RETURNING id",args:[org,name]})

async function setup(t, overrides={}) {
    const db=await database(t)
    const previous=process.env.GOOGLE_SHEETS_ENCRYPTION_KEY
    process.env.GOOGLE_SHEETS_ENCRYPTION_KEY='ab'.repeat(32)
    t.after(()=>{if(previous===undefined)delete process.env.GOOGLE_SHEETS_ENCRYPTION_KEY;else process.env.GOOGLE_SHEETS_ENCRYPTION_KEY=previous})
    const {sheets,access}=service(db)
    const integration=await sheets.createGoogleSheetsIntegration('a',{
        enabled:true,
        webAppUrl:'https://script.google.com/macros/s/deployment/exec',
        secret:'test-secret',
        ...overrides
    })
    return {db,sheets,access,integrationId:integration.id}
}
function capture(t) {
    const sent=[]
    t.mock.method(globalThis,'fetch',async (url,options)=>{
        const p=JSON.parse(options.body);sent.push(p)
        return Response.json({ok:true,protocol:2,organizationId:p.organizationId,action:p.action,id:p.lead?.id,version:p.version,applied:true})
    })
    return sent
}
test('worker sends newest five fields, readable status and sorted notes only to their owner',async t=>{
    const {db,sheets}=await setup(t)
    const sent=capture(t)
    await insert(db,'a','  Full   Name ')
    await insert(db,'b','Other tenant')
    await insert(db,null,'Unassigned legacy')
    await db.execute("INSERT INTO customer_notes(customer_id,note,created_at) VALUES (1,'Old',100000),(1,'New',200000)")
    await db.execute("UPDATE status SET status='Interesado' WHERE id=1")
    const result=await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:10,timeBudgetMs:20000})
    assert.equal(result.succeeded,1)
    assert.equal(sent.length,1)
    assert.equal(sent[0].organizationId,'a')
    assert.deepEqual(Object.keys(sent[0].lead).sort(),['email','id','name','notes','phone','status'])
    assert.equal(sent[0].lead.name,'Full Name')
    assert.equal(sent[0].lead.status,'Interesado')
    assert.ok(sent[0].lead.notes.indexOf('New')<sent[0].lead.notes.indexOf('Old'))
    assert.equal(sent[0].lead.phone,'001')
    assert.equal(sent[0].lead.email,'')
    await db.execute('DELETE FROM customers WHERE id=1')
    await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:10})
    assert.equal(sent[1].action,'delete')
    assert.equal(sent[1].lead.id,'a:customer:1')
})
test('settings do not expose secrets; roles are checked in the organization',async t=>{
    const {db,sheets,access,integrationId}=await setup(t)
    const [integration]=await sheets.listGoogleSheetsIntegrations('a')
    assert.equal(integration.hasSecret,true)
    assert.equal(JSON.stringify(integration).includes('test-secret'),false)
    const stored=(await db.execute("SELECT secret_encrypted FROM google_sheets_integrations WHERE organization_id='a'")).rows[0].secret_encrypted
    assert.ok(stored.startsWith('v1.'))
    assert.notEqual(stored,'test-secret')
    const session={user:{id:'u',role:'admin'},session:{activeOrganizationId:'a'}}
    assert.equal(await access.organizationAccess(session,true),null)
    await db.execute("INSERT INTO member(id,organization_id,user_id,role,created_at) VALUES ('m','a','u','member',0)")
    assert.equal(await access.organizationAccess(session,true),null)
    await db.execute("UPDATE member SET role='owner' WHERE id='m'")
    assert.equal(await access.organizationAccess(session,true),'a')
    assert.equal(await access.organizationAccess({...session,session:{activeOrganizationId:'b'}},true),null)
    await insert(db,'a');await insert(db,'b')
    assert.equal(await access.canAccessLeads(session,'customer',[1]),true)
    assert.equal(await access.canAccessLeads(session,'customer',[1,2]),false)
    assert.equal((await sheets.getGoogleSheetsIntegration('a',integrationId)).hasSecret,true)
})
test('temporary failure persists, backs off and can be explicitly retried',async t=>{
    const {db,sheets,integrationId}=await setup(t)
    await insert(db,'a')
    t.mock.method(globalThis,'fetch',async()=>{throw new Error('private data from network')})
    const result=await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:1})
    assert.equal(result.failed,1)
    const job=(await db.execute("SELECT * FROM google_sheets_sync_jobs WHERE status='failed'")).rows[0]
    assert.equal(job.attempts,1)
    assert.ok(Number(job.next_attempt_at)>Date.now()/1000)
    assert.equal(job.last_error.includes('private data'),false)
    t.mock.restoreAll();capture(t)
    await sheets.retryFailedGoogleSheetsSyncs('a',integrationId)
    assert.equal((await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:1})).succeeded,1)
})
test('concurrent workers do not claim an active job twice',async t=>{
    const {db,sheets}=await setup(t)
    await insert(db,'a')
    // Finish scan before the competing workers, to isolate claiming.
    await db.execute("UPDATE google_sheets_integrations SET customer_cursor=NULL,travel_cursor=NULL")
    let calls=0
    t.mock.method(globalThis,'fetch',async (_,options)=>{
        calls++
        await new Promise(resolve=>setTimeout(resolve,30))
        const p=JSON.parse(options.body)
        return Response.json({ok:true,protocol:2,organizationId:'a',action:p.action,id:p.lead.id,version:p.version,applied:true})
    })
    await Promise.all([sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:1}),sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:1})])
    assert.equal(calls,1)
})
test('bulk scan persists its cursor and resumes across invocations',async t=>{
    const {db,sheets,integrationId}=await setup(t)
    capture(t)
    for(let i=0;i<205;i++)await insert(db,'a')
    await sheets.syncIntegrationLeads('a',integrationId)
    for(const expected of [100,200,null]) {
        await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:1})
        const row=(await db.execute("SELECT customer_cursor FROM google_sheets_integrations WHERE organization_id='a'")).rows[0]
        assert.equal(row.customer_cursor,expected)
    }
    assert.equal((await sheets.getGoogleSheetsIntegration('a',integrationId)).status.scanning,false)
})
test('disabling sync retains deletes for delivery after reactivation',async t=>{
    const {db,sheets,integrationId}=await setup(t)
    const sent=capture(t)
    await insert(db,'a')
    await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:10})
    await sheets.updateGoogleSheetsIntegration('a',integrationId,{enabled:false})
    await db.execute('DELETE FROM customers WHERE id=1')
    assert.equal((await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:10})).processed,0)
    await sheets.updateGoogleSheetsIntegration('a',integrationId,{enabled:true})
    await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:10})
    assert.equal(sent.at(-1).action,'delete')
})
test('multiple integrations export only the selected sources to their own sheet',async t=>{
    const {db,sheets}=await setup(t,{
        name:'Contactos',
        syncCustomers:true,
        syncTravel:false,
        webAppUrl:'https://script.google.com/macros/s/customers_sheet/exec'
    })
    await sheets.createGoogleSheetsIntegration('a',{
        name:'Viajes',
        enabled:true,
        webAppUrl:'https://script.google.com/macros/s/travel_sheet/exec',
        secret:'test-secret',
        syncCustomers:false,
        syncTravel:true
    })
    await db.execute("INSERT OR IGNORE INTO travel_statuses(id,status) VALUES (1,'Nuevo viaje')")
    const sent=[]
    t.mock.method(globalThis,'fetch',async (url,options)=>{
        const p=JSON.parse(options.body);sent.push({url:String(url),payload:p})
        return Response.json({ok:true,protocol:2,organizationId:p.organizationId,action:p.action,id:p.lead?.id,version:p.version,applied:true})
    })
    await insert(db,'a','Customer lead')
    await insertTravel(db,'a','Travel lead')
    const result=await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:20})
    assert.equal(result.succeeded,2)
    assert.equal(sent.length,2)
    const customerRequest=sent.find(entry=>entry.payload.lead.id.includes(':customer:'))
    const travelRequest=sent.find(entry=>entry.payload.lead.id.includes(':travel:'))
    assert.ok(customerRequest.url.includes('customers_sheet'))
    assert.ok(travelRequest.url.includes('travel_sheet'))
})
test('status filters only export matching leads and remove excluded rows',async t=>{
    const {db,sheets}=await setup(t,{
        syncCustomers:true,
        syncTravel:false,
        customerStatusIds:[1]
    })
    await db.execute("INSERT INTO status(id,status) VALUES (2,'Descartado')")
    const sent=capture(t)
    await insert(db,'a','Nuevo lead',1)
    await insert(db,'a','Descartado lead',2)
    const result=await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:20})
    assert.equal(result.succeeded,2)
    const byId=new Map(sent.map(entry=>[entry.lead.id,entry]))
    assert.equal(byId.get('a:customer:1').action,'upsert')
    assert.equal(byId.get('a:customer:2').action,'delete')

    // Moving a lead out of the selected status removes the exported row.
    await db.execute("UPDATE customers SET status_id=2 WHERE id=1")
    await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:20})
    assert.equal(sent.at(-1).action,'delete')
    assert.equal(sent.at(-1).lead.id,'a:customer:1')
})
test('changing filters restarts the reconciliation scan',async t=>{
    const {db,sheets,integrationId}=await setup(t,{
        syncCustomers:true,
        syncTravel:false,
        customerStatusIds:[1]
    })
    await insert(db,'a')
    await sheets.processPendingGoogleSheetsSyncs({organizationId:'a',limit:10})
    await db.execute("UPDATE google_sheets_integrations SET customer_cursor=NULL")
    await sheets.updateGoogleSheetsIntegration('a',integrationId,{customerStatusIds:[1,2]})
    const row=(await db.execute({sql:"SELECT customer_cursor FROM google_sheets_integrations WHERE id=?",args:[integrationId]})).rows[0]
    assert.equal(row.customer_cursor,0)
})
test('field selection is stored canonically, defaults to all and rejects empty',async t=>{
    const {db,sheets,integrationId}=await setup(t,{fields:['email','name']})
    const [integration]=await sheets.listGoogleSheetsIntegrations('a')
    assert.deepEqual(integration.fields,['name','email'])
    const stored=(await db.execute({sql:"SELECT fields FROM google_sheets_integrations WHERE id=?",args:[integrationId]})).rows[0].fields
    assert.equal(stored,JSON.stringify(['name','email']))
    const updated=await sheets.updateGoogleSheetsIntegration('a',integrationId,{fields:['status']})
    assert.deepEqual(updated.fields,['status'])
    const all=await sheets.updateGoogleSheetsIntegration('a',integrationId,{fields:['name','phone','email','notes','status']})
    assert.deepEqual(all.fields,['name','phone','email','notes','status'])
    const cleared=(await db.execute({sql:"SELECT fields FROM google_sheets_integrations WHERE id=?",args:[integrationId]})).rows[0].fields
    assert.equal(cleared,null)
    await assert.rejects(sheets.updateGoogleSheetsIntegration('a',integrationId,{fields:[]}),/al menos un campo/)
    const another=await sheets.createGoogleSheetsIntegration('a',{enabled:false})
    assert.deepEqual(another.fields,['name','phone','email','notes','status'])
})
test('generated Apps Script reflects selected fields, stays valid and embeds no secrets',async t=>{
    const db=await database(t)
    const {appsScript}=service(db)
    const config={integrationName:'Contactos – Hoja comercial',organizationId:'org-a',fields:['name','status']}
    const code=appsScript.buildAppsScript(config)
    assert.match(code,/var FIELDS = \["name","status"\];/)
    assert.match(code,/var HEADERS = \["Nombre","Estado","__id"\];/)
    assert.ok(code.includes('LAYOUT_MISMATCH'))
    assert.ok(code.includes('var freshSheet = sheet.getLastRow() === 0;'))
    assert.ok(code.includes("PropertiesService.getScriptProperties()"))
    assert.ok(!code.includes('test-secret'))
    assert.doesNotThrow(()=>new Function(code))
    const properties=appsScript.appsScriptProperties(config)
    assert.deepEqual(properties.map(property=>property.key),['API_SECRET','ORGANIZATION_ID','SPREADSHEET_ID'])
    assert.equal(properties[0].value,'')
    assert.equal(properties[1].value,'org-a')
    assert.equal(properties[2].value,'')
    assert.equal(appsScript.appsScriptFilename(config),'contactos-hoja-comercial-apps-script.js')
    assert.ok(appsScript.APPS_SCRIPT_STEPS.length>=6)
})
