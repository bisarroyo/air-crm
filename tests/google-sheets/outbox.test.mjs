import test from 'node:test'
import assert from 'node:assert/strict'
import {database} from './fixture.mjs'
const insert=(db,org='a')=>db.execute({sql:"INSERT INTO customers(organization_id,name,phone,email,travel_time,assigned_to) VALUES (?, 'Name', '001', '', '0', 'u') RETURNING id",args:[org]})
const insertTravel=(db,org='a')=>db.execute({sql:"INSERT INTO travel_leads(organization_id,name,phone,email) VALUES (?, 'Travel', '002', '') RETURNING id",args:[org]})
const integration=(db,org='a',fields={})=>{
    const {syncCustomers=true,syncTravel=true}=fields
    return db.execute({sql:'INSERT INTO google_sheets_integrations(organization_id,sync_customers,sync_travel) VALUES (?, ?, ?) RETURNING id',args:[org,syncCustomers?1:0,syncTravel?1:0]})
}
test('lead + outbox commit/rollback together and preserve tenant ownership',async t=>{
    const db=await database(t)
    const a=Number((await integration(db,'a')).rows[0].id)
    const b=Number((await integration(db,'b')).rows[0].id)
    const tx=await db.transaction('write')
    await insert(tx)
    await tx.rollback()
    assert.equal((await db.execute('SELECT * FROM customers')).rows.length,0)
    assert.equal((await db.execute('SELECT * FROM google_sheets_sync_jobs')).rows.length,0)
    await insert(db)
    await insert(db,'b')
    await insert(db,null)
    const jobs=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id')).rows
    assert.deepEqual(jobs.map(j=>j.organization_id),['a','b'])
    assert.deepEqual(jobs.map(j=>Number(j.integration_id)),[a,b])
    assert.equal(jobs[0].version,jobs[0].id)
    await assert.rejects(db.execute("UPDATE customers SET organization_id='b' WHERE id=1"),/inmutable/)
})
test('only visible-field changes enqueue; notes, status rename and delete are atomic',async t=>{
    const db=await database(t)
    await integration(db,'a')
    await integration(db,'b')
    await insert(db)
    const count=async()=>Number((await db.execute('SELECT count(*) AS n FROM google_sheets_sync_jobs')).rows[0].n)
    await db.execute("UPDATE customers SET country='CR' WHERE id=1")
    assert.equal(await count(),1)
    for(const field of ['name','phone','email']) await db.execute(`UPDATE customers SET ${field}='changed' WHERE id=1`)
    assert.equal(await count(),4)
    await db.execute("INSERT INTO customer_notes(customer_id,note,user_id) VALUES (1,'first','u')")
    await db.execute("UPDATE customer_notes SET note='edited' WHERE id=1")
    await db.execute('DELETE FROM customer_notes WHERE id=1')
    assert.equal(await count(),7)
    await insert(db,'b')
    await db.execute("UPDATE status SET status='Interesado' WHERE id=1")
    assert.equal(await count(),10)
    await db.execute('DELETE FROM customers WHERE id=1')
    const last=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id DESC LIMIT 1')).rows[0]
    assert.equal(last.operation,'delete')
    assert.equal(last.organization_id,'a')
})
test('each integration only receives jobs for the sources it syncs',async t=>{
    const db=await database(t)
    await db.execute("INSERT OR IGNORE INTO travel_statuses(id,status) VALUES (1,'Nuevo viaje')")
    const customersOnly=Number((await integration(db,'a',{syncCustomers:true,syncTravel:false})).rows[0].id)
    const travelOnly=Number((await integration(db,'a',{syncCustomers:false,syncTravel:true})).rows[0].id)

    await insert(db,'a')
    let jobs=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id')).rows
    assert.deepEqual(jobs.map(j=>Number(j.integration_id)),[customersOnly])

    await insertTravel(db,'a')
    jobs=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id')).rows
    assert.deepEqual(jobs.map(j=>Number(j.integration_id)),[customersOnly,travelOnly])
    assert.equal(jobs[1].lead_source,'travel')

    // Disabling a source stops new jobs for it but keeps the other one working.
    await db.execute({sql:'UPDATE google_sheets_integrations SET sync_customers=0 WHERE id=?',args:[customersOnly]})
    await insert(db,'a','Second')
    jobs=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id')).rows
    assert.equal(jobs.filter(j=>Number(j.integration_id)===customersOnly).length,1)

    // Customer notes do not leak into integrations that only sync travel.
    await db.execute("INSERT INTO customer_notes(customer_id,note,user_id) VALUES (1,'first','u')")
    jobs=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id')).rows
    assert.equal(jobs.length,2)
    assert.equal(jobs.filter(j=>Number(j.integration_id)===travelOnly).length,1)

    // Deleting a lead notifies every integration that syncs its source.
    await db.execute('DELETE FROM travel_leads WHERE id=1')
    const last=(await db.execute('SELECT * FROM google_sheets_sync_jobs ORDER BY id DESC LIMIT 1')).rows[0]
    assert.equal(last.lead_source,'travel')
    assert.equal(last.operation,'delete')
    assert.equal(Number(last.integration_id),travelOnly)
})
