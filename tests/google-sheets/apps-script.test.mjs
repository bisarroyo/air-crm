import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const code=fs.readFileSync(new URL('../../docs/google-sheets/apps-script.js',import.meta.url),'utf8')
function sheet(headers) {
    const rows=[headers]
    return {rows, getLastRow:()=>rows.length, getMaxRows:()=>10000,
        getMaxColumns:()=>Math.max(6,...rows.map(row=>row.length)),
        insertColumnsAfter(){}, setFrozenRows(){}, hideColumns(){}, hideSheet(){},
        deleteRow:n=>rows.splice(n-1,1),
        getRange(row,col,height=1,width=1) {
            return { setNumberFormat(){return this},
                setFontWeight(){return this},
                setValues(values) {values.forEach((v,i)=>{rows[row-1+i]??=[];v.forEach((x,j)=>rows[row-1+i][col-1+j]=x)}); return this},
                setValue(value){rows[row-1][col-1]=value;return this},
                getDisplayValue(){return String(rows[row-1]?.[col-1]??'')},
                getDisplayValues(){return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(rows[row-1+i]?.[col-1+j]??'')))},
                createTextFinder(id){return {matchEntireCell(){return this},useRegularExpression(){return this},findAll(){return rows.slice(row-1,row-1+height).flatMap((r,i)=>r[col-1]===id?[{getRow:()=>row+i}]:[])}}}
            }
        }
    }
}
function setup() {
    const ctx=vm.createContext({SpreadsheetApp:{flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>({API_SECRET:'secret',ORGANIZATION_ID:'org',SPREADSHEET_ID:'book'})[k]})}, LockService:{getScriptLock:()=>({hasLock:()=>false})}, ContentService:{createTextOutput:text=>({setMimeType:()=>JSON.parse(text)}),MimeType:{JSON:'json'}}})
    vm.runInContext(code,ctx)
    return {ctx,leads:sheet(['Name','Phone','Email','Notes','Status','ID']),ledger:sheet(['ID','Version','State'])}
}
test('upserts are idempotent, IDs distinguish same-name leads; old deletes cannot remove newer rows',()=>{
    const {ctx,leads,ledger}=setup()
    const lead={id:'org:customer:1',name:'Same',phone:'00123',email:null,notes:'new note',status:'Interesado'}
    ctx.applyOperation_(leads,ledger,'upsert',lead,200)
    ctx.applyOperation_(leads,ledger,'upsert',{...lead,id:'org:customer:2'},201)
    assert.equal(ctx.applyOperation_(leads,ledger,'upsert',lead,200).reason,'duplicate')
    assert.equal(ctx.applyOperation_(leads,ledger,'delete',lead,100).reason,'stale')
    assert.equal(leads.rows.length,3)
    assert.equal(leads.rows[1][1],'00123')
    assert.equal(leads.rows[1][2],'')
    assert.equal(leads.rows[1][4],'Interesado')
    ctx.applyOperation_(leads,ledger,'delete',lead,300)
    assert.equal(leads.rows.length,2)
    assert.equal(ctx.applyOperation_(leads,ledger,'upsert',lead,200).reason,'stale')
})
test('deletion history survives more than 500 deleted leads',()=>{
    const {ctx,leads,ledger}=setup()
    for(let i=1;i<=501;i++)ctx.applyOperation_(leads,ledger,'delete',{id:'org:customer:'+i},i+1000)
    assert.equal(ctx.applyOperation_(leads,ledger,'upsert',{id:'org:customer:1'},1).reason,'stale')
    assert.equal(ledger.rows.length,502)
})
test('an interrupted write can retry the same revision',()=>{
    const {ctx,leads,ledger}=setup()
    ledger.rows.push(['org:customer:1','2','pending'])
    assert.equal(ctx.applyOperation_(leads,ledger,'upsert',{id:'org:customer:1',name:'Recovered'},2).applied,true)
    assert.equal(leads.rows[1][0],'Recovered')
})
test('formulas and nulls become text',()=>{
    const {ctx}=setup()
    for(const text of ['=1+1','+123','@x','-1',' \t=HYPERLINK("x")']) assert.equal(ctx.safeCell_(text),"'"+text)
    assert.equal(ctx.safeCell_(null),'')
})
test('wrong secret or organization never accesses sheets',()=>{
    const {ctx}=setup()
    const invoke=body=>ctx.doPost({postData:{contents:JSON.stringify(body)}})
    assert.equal(invoke({secret:'wrong',organizationId:'org',action:'ping',protocol:2}).code,'UNAUTHORIZED')
    assert.equal(invoke({secret:'secret',organizationId:'another',action:'ping',protocol:2}).code,'ORGANIZATION_MISMATCH')
})
test('replacing an empty Leads tab accepts a new field layout and keeps the ledger',()=>{
    const {ctx,leads,ledger}=setup()
    leads.rows.length=0
    ledger.rows.splice(0,ledger.rows.length,['ID','Version','State','org','name,phone,email,notes,status'])
    ctx.FIELDS=['name','status']
    ctx.HEADERS=['Nombre','Estado','__id']
    ctx.ID_COLUMN=3
    ctx.COLUMN_COUNT=3
    ctx.LAYOUT='name,status'
    ctx.ensureLayout_(leads,ledger,'org')
    assert.deepEqual(leads.rows[0].slice(0,3),['Nombre','Estado','__id'])
    assert.equal(ledger.rows[0][4],'name,status')
    ctx.applyOperation_(leads,ledger,'upsert',{id:'org:customer:1',name:'N',status:'Nuevo'},10)
    assert.deepEqual(leads.rows[1].slice(0,3),['N','Nuevo','org:customer:1'])
})
test('a populated Leads tab with different headers still rejects a new layout',()=>{
    const {ctx,leads,ledger}=setup()
    ledger.rows.splice(0,ledger.rows.length,['ID','Version','State','org','name,phone,email,notes,status'])
    leads.rows.splice(0,leads.rows.length,['Nombre','Correo','__id'],['N','n@example.test','org:customer:1'])
    ctx.FIELDS=['name','status']
    ctx.HEADERS=['Nombre','Estado','__id']
    ctx.ID_COLUMN=3
    ctx.COLUMN_COUNT=3
    ctx.LAYOUT='name,status'
    assert.throws(()=>ctx.ensureLayout_(leads,ledger,'org'),/LAYOUT_MISMATCH/)
})
