require('./load.cjs')
const test = require('node:test')
const assert = require('node:assert/strict')
const { defaultDraft, validateDraftPure, formatMoneyCompact, toDraft } = require('../../lib/cotizaciones/shared.ts')
const { computeTotals, computeDiscountLines } = require('../../lib/cotizaciones/pricing.ts')
const { buildDocDefinition, buildQuotationPdf } = require('../../lib/cotizaciones/pdf.ts')
const { buildCatalogValues, mapRow } = require('../../lib/cotizaciones/catalog-values.ts')
const { CATALOG_DEFS } = require('../../lib/cotizaciones/catalog-def.ts')
function fixture(currency = 'EUR') {
    const draft = defaultDraft({ name: 'Cliente de prueba' }, { name: 'Asesor de prueba' }, currency, new Date(2026, 10, 16))
    draft.program = { id: 1, name: 'Programa de idiomas', includes: ['Certificado', 'Materiales'] }
    draft.course = { id: 1, name: 'Curso intensivo', schoolName: 'Escuela de idiomas', scheduleName: 'Mañana', weeks: 4, hoursPerWeek: 20, price: 1000.55 }
    draft.accommodation = { ...draft.accommodation, included: true, name: 'Residencia', weeks: 3, pricePerWeek: 120.25 }
    draft.extras = [{ key: 'extra', id: 1, name: 'Traslado', price: 25.15 }]
    draft.discounts = [
        { key: 'percent', id: 1, name: 'Cupón bienvenida', type: 'percent', value: 12.5, currency, amount: 999, startsAt: null, endsAt: '2026-12-31' },
        { key: 'fixed', id: 2, name: 'Cupón especial', type: 'fixed', value: 30.10, currency, amount: 999, startsAt: null, endsAt: null }
    ]
    return { ...draft, company: { companyName: 'S Travel Costa Rica', currency, terms: 'Condiciones de prueba', email: 'info@example.com' }, totals: { course: 999, accommodation: 999, extras: 999, subtotal: 999, discount: 999, total: 999 } }
}
function texts(node, result = []) {
    if (!node || typeof node !== 'object') return result
    if (typeof node.text === 'string') result.push(node.text)
    Object.values(node).forEach(value => { if (Array.isArray(value)) value.forEach(item => texts(item, result)); else if (value && typeof value === 'object') texts(value, result) })
    return result
}
test('course is a package price; accommodation is weekly; coupons retain cents', () => {
    assert.deepEqual(computeTotals(fixture()), { course: 1000.55, accommodation: 360.75, extras: 25.15, subtotal: 1386.45, discount: 203.41, total: 1183.04 })
    assert.deepEqual(computeDiscountLines(fixture()).map(d => d.amount), [173.31, 30.1])
})
test('changing prices recalculates coupons instead of trusting saved amounts', () => {
    const data = fixture(); data.course.price = 1100.55
    assert.equal(computeDiscountLines(data)[0].amount, 185.81)
    assert.equal(computeTotals(data).total, 1270.54)
    assert.equal(toDraft(JSON.parse(JSON.stringify(data))).discounts.length, 2)
})
test('stacked coupons never exceed subtotal and use the original subtotal for percentages', () => {
    const data = fixture(); data.course.price = .3; data.accommodation.included = false; data.extras = []
    data.discounts = [1,2,3,4].map(id => ({ ...data.discounts[1], id, value: .1 }))
    assert.deepEqual(computeDiscountLines(data).map(d => d.amount), [.1,.1,.1,0])
    assert.equal(computeTotals(data).total, 0)
    data.course.price = 100; data.discounts = [1,2].map(id => ({ ...data.discounts[0], id, type: 'percent', value: 10 }))
    assert.equal(computeTotals(data).total, 80)
})
test('invalid numeric values, duplicate coupons and currency mismatches are rejected', () => {
    for (const price of [NaN, Infinity, -1, null]) { const data = fixture(); data.course.price = price; assert.ok(validateDraftPure(data)) }
    const duplicate = fixture(); duplicate.discounts.push(duplicate.discounts[0]); assert.match(validateDraftPure(duplicate), /más de una vez/)
    const mismatch = fixture(); mismatch.discounts[1].currency = 'USD'; assert.match(validateDraftPure(mismatch), /moneda/)
    const invalidDate = fixture(); invalidDate.issueDate = '2026-02-30'; assert.ok(validateDraftPure(invalidDate))
    assert.equal(validateDraftPure(fixture()), null)
})
test('PDF includes both coupon names, percentage, deductions and recalculated totals in all currencies', () => {
    for (const currency of ['EUR','USD','CRC']) {
        const data = fixture(currency); const output = texts(buildDocDefinition(data, 'TEST-001'))
        assert.ok(output.includes('Cupón bienvenida (12.5%)'))
        assert.ok(output.includes('Cupón especial'))
        for (const amount of [173.31,30.1,203.41]) assert.ok(output.includes(`- ${formatMoneyCompact(amount,currency)}`))
        assert.ok(output.includes(formatMoneyCompact(1183.04,currency)))
        assert.ok(!output.includes(formatMoneyCompact(999,currency)))
    }
})
test('catalog round-trips fixed money and percentages without changing units', () => {
    for (const [type,value] of [['percent',12.5],['fixed',30.1]]) {
        const result = buildCatalogValues({ name: 'Cupón', type, value, currency: 'EUR' }, CATALOG_DEFS.discounts)
        assert.equal(result.error,null)
        assert.equal(result.values.value,Math.round(value*100))
        assert.equal(mapRow(CATALOG_DEFS.discounts,result.values).value,value)
    }
})
test('catalog rejects invalid discount values and dates, and allows clearing dates', () => {
    for (const change of [{value:101},{value:0},{value:Infinity},{type:'invalid'},{startsAt:'2026-02-30'},{startsAt:'2026-12-31',endsAt:'2026-01-01'}]) {
        assert.ok(buildCatalogValues({name:'Cupón',type:'percent',value:10,...change},CATALOG_DEFS.discounts).error)
    }
    assert.deepEqual(buildCatalogValues({endsAt:null},CATALOG_DEFS.discounts,{partial:true}).values,{endsAt:null})
})
test('actual PDF generation succeeds with coupons, no coupons, and long multipage content', async () => {
    const fs = require('node:fs')
    for (const variant of ['coupons','no-coupons','long']) {
        const data = fixture()
        if (variant === 'no-coupons') data.discounts = []
        if (variant === 'long') {
            data.extras = Array.from({length:35},(_,i)=>({key:String(i),name:`Extra ${i+1} con una descripción larga para comprobar el salto de página`,price:25.15}))
            data.company.terms = 'Condiciones generales de la cotización. '.repeat(100)
        }
        const buffer = await buildQuotationPdf(data,'TEST-001')
        assert.equal(buffer.subarray(0,5).toString(),'%PDF-')
        if (process.env.QUOTATION_PDF_OUTPUT) {
            fs.mkdirSync(process.env.QUOTATION_PDF_OUTPUT,{recursive:true})
            fs.writeFileSync(`${process.env.QUOTATION_PDF_OUTPUT}/${variant}.pdf`,buffer)
        }
    }
})
module.exports = { fixture }

test('create and update persist recalculated coupon lines used by the downloaded PDF', async () => {
    const Module = require('node:module')
    const path = require('node:path')
    const fs = require('node:fs')
    const ts = require('typescript')
    const tables = { quotations: { id: 'id' }, quotationItems: { quotationId: 'quotationId' }, quotationSettings: { id: 'id' } }
    let saved = null
    let items = []
    const db = {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ ...fixture().company }] }) }) }),
        insert: table => ({ values: values => {
            if (table === tables.quotations) return { returning: async () => { saved = { ...values, id: 42 }; return [saved] } }
            items = values
            return Promise.resolve()
        } }),
        update: () => ({ set: values => ({ where: () => ({ returning: async () => { saved = { ...saved, ...values }; return [saved] } }) }) }),
        delete: () => ({ where: async () => { items = [] } })
    }
    const filename = path.resolve('lib/cotizaciones/quotation.ts')
    const compiled = new Module(filename, module)
    compiled.filename = filename
    compiled.paths = module.paths
    compiled.require = specifier => {
        if (specifier === '@/db') return { db }
        if (specifier === '@/db/schema') return tables
        if (specifier === './numbering') return { nextQuotationNumber: async () => 'TEST-001', parseCurrency: value => value || 'EUR' }
        if (specifier.startsWith('./')) return require(path.resolve(path.dirname(filename), specifier))
        return require(specifier)
    }
    compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText, filename)
    const { createQuotation, updateQuotation, parseQuotationData } = compiled.exports
    const input = { data: fixture(), status: 'sent' }
    const session = { id: 'test-user', name: 'Advisor', email: 'advisor@example.com' }
    assert.equal((await createQuotation(1, input, session)).error, undefined)
    assert.deepEqual(items.filter(item => item.kind === 'discount').map(item => item.totalCents), [-17331,-3010])
    assert.deepEqual(JSON.parse(saved.data).discounts.map(d => d.amount), [173.31,30.1])
    input.data.course.price = 1100.55
    assert.equal((await updateQuotation(42, input, session)).error, undefined)
    assert.deepEqual(items.filter(item => item.kind === 'discount').map(item => item.totalCents), [-18581,-3010])
    const data = parseQuotationData(saved)
    assert.equal(data.totals.total,1270.54)
    const output = texts(buildDocDefinition(data,saved.number))
    assert.ok(output.includes('Cupón bienvenida (12.5%)'))
    assert.ok(output.includes('Cupón especial'))
    assert.ok(output.includes(formatMoneyCompact(1270.54,'EUR')))
})
