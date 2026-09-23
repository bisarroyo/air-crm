'use client'

import {
    formatDateLong,
    formatMoney,
    quotationIncludes,
    type QuotationData
} from '@/lib/cotizaciones/shared'
import { computeDiscountLines } from '@/lib/cotizaciones/pricing'

const ACCENT = '#0F766E'
const ACCENT_DARK = '#134E4A'
const MUTED = '#6B7280'
const BORDER = '#E5E7EB'
const LIGHT = '#F0FDFA'

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            className='mb-1 text-[11px] font-semibold uppercase tracking-wider'
            style={{ color: ACCENT_DARK }}>
            {children}
        </div>
    )
}

function LabelValue({
    label,
    value
}: {
    label: string
    value: string | number | null | undefined
}) {
    return (
        <div className='grid grid-cols-2 gap-2 py-1 text-[13px] sm:grid-cols-3'>
            <div className='text-muted-foreground' style={{ color: MUTED }}>
                {label}
            </div>
            <div className='col-span-1 sm:col-span-2'>
                {String(value ?? '—')}
            </div>
        </div>
    )
}

function Line({ strong = false }: { strong?: boolean }) {
    return (
        <div
            className='w-full'
            style={{
                borderTop: strong
                    ? `2px solid ${ACCENT}`
                    : `1px solid ${BORDER}`
            }}
        />
    )
}

function CostRow({
    label,
    value,
    bold,
    total
}: {
    label: React.ReactNode
    value: string
    bold?: boolean
    total?: boolean
}) {
    return (
        <div
            className={`flex items-center justify-between px-2 py-1 text-[13px] ${
                bold ? 'font-semibold' : ''
            }`}
            style={
                total
                    ? {
                          backgroundColor: ACCENT,
                          color: '#fff',
                          borderRadius: 4
                      }
                    : undefined
            }>
            <span className={total ? 'font-semibold' : ''}>{label}</span>
            <span
                className={total ? 'font-semibold' : ''}
                style={{ textAlign: 'right' }}>
                {value}
            </span>
        </div>
    )
}

export function QuotationPreview({
    data,
    number
}: {
    data: QuotationData
    number: string
}) {
    const currency = data.currency
    const money = (amount: number) => formatMoney(amount, currency)
    const company = data.company
    const totals = data.totals
    const lines = computeDiscountLines(data)

    return (
        <div className='mx-auto w-full max-w-6xl rounded-xl border bg-white p-6 text-gray-900 shadow-sm sm:p-8 dark:bg-white'>
            {/* Header */}
            <div className='flex items-start justify-between gap-4'>
                <div className=''>
                    {company.logo?.startsWith('data:') ? (
                        <img
                            src={company.logo}
                            alt={company.companyName}
                            className='w-full object-contain'
                        />
                    ) : (
                        <div
                            className='text-lg font-bold'
                            style={{ color: ACCENT_DARK }}>
                            {company.companyName}
                        </div>
                    )}
                </div>
                <div className='text-right'>
                    <div
                        className='text-2xl font-bold'
                        style={{ color: ACCENT }}>
                        COTIZACIÓN
                    </div>
                    <div className='mt-1 text-sm font-semibold'>
                        N.º {number}
                    </div>
                    <div className='mt-2 text-xs' style={{ color: MUTED }}>
                        Fecha de emisión: {formatDateLong(data.issueDate)}
                    </div>
                    <div className='text-xs' style={{ color: MUTED }}>
                        Válida hasta: {formatDateLong(data.validUntil)}
                    </div>
                </div>
            </div>

            <div className='my-4'>
                <Line strong />
            </div>

            {/* Asesor + Cliente */}
            <div className='grid gap-6 sm:grid-cols-2'>
                <div>
                    <SectionLabel>Asesor</SectionLabel>
                    <LabelValue
                        label='Nombre'
                        value={data.advisor.name || company.advisorName || '—'}
                    />
                    <LabelValue
                        label='Email'
                        value={
                            data.advisor.email || company.advisorEmail || '—'
                        }
                    />
                    <LabelValue label='Teléfono' value={company.phone} />
                    <LabelValue label='WhatsApp' value={company.whatsapp} />
                </div>
                <div>
                    <SectionLabel>Datos del cliente</SectionLabel>
                    <LabelValue label='Cliente' value={data.client.name} />
                    <LabelValue label='Teléfono' value={data.client.phone} />
                    <LabelValue label='Email' value={data.client.email} />
                    <LabelValue label='País' value={data.client.country} />
                </div>
            </div>

            {/* Programa */}
            {data.program && (
                <div className='mt-6'>
                    <SectionLabel>Programa</SectionLabel>
                    <div className='text-base font-bold'>
                        {data.program.name}
                    </div>
                </div>
            )}

            {data.course && (
                <div className='mt-3'>
                    <LabelValue
                        label='Escuela'
                        value={data.course.schoolName}
                    />
                    <LabelValue label='Curso' value={data.course.name} />
                    {/* <LabelValue
                        label='Horario'
                        value={data.course.scheduleName}
                    /> */}
                    <LabelValue
                        label='Duración'
                        value={`${data.course.weeks} semanas · ${data.course.hoursPerWeek} horas/semana`}
                    />
                </div>
            )}

            {/* Incluye */}
            {quotationIncludes(data).length > 0 && (
                <div className='mt-6'>
                    <SectionLabel>Incluye</SectionLabel>
                    <ul className='text-[13px]'>
                        <div className='grid gap-x-4 text-[13px] sm:grid-cols-2'>
                            {quotationIncludes(data).map((item) => (
                                <li key={item} className='py-0.5'>
                                    • {item}
                                </li>
                            ))}
                        </div>
                    </ul>
                </div>
            )}

            {/* Alojamiento */}
            <div className='mt-6'>
                <SectionLabel>Alojamiento</SectionLabel>
                {data.accommodation.included ? (
                    <div>
                        <LabelValue
                            label='Tipo'
                            value={data.accommodation.name}
                        />
                        <LabelValue
                            label='Semanas'
                            value={data.accommodation.weeks}
                        />
                        <LabelValue
                            label='Precio semanal'
                            value={money(data.accommodation.pricePerWeek)}
                        />
                        <LabelValue
                            label='Total'
                            value={money(totals.accommodation)}
                        />
                    </div>
                ) : (
                    <div className='text-[13px]' style={{ color: MUTED }}>
                        No incluye alojamiento
                    </div>
                )}
            </div>

            {/* Extras */}
            <div className='mt-6'>
                <SectionLabel>Extras</SectionLabel>
                {data.extras.length === 0 ? (
                    <div className='text-[13px]' style={{ color: MUTED }}>
                        Sin extras
                    </div>
                ) : (
                    <div className='overflow-hidden rounded-md border'>
                        <div
                            className='flex items-center justify-between px-2 py-1.5 text-[13px] font-semibold'
                            style={{ backgroundColor: LIGHT }}>
                            <span>Concepto</span>
                            <span>Monto</span>
                        </div>
                        {data.extras.map((extra) => (
                            <div
                                key={extra.key}
                                className='flex items-center justify-between border-t px-2 py-1.5 text-[13px]'
                                style={{ borderColor: BORDER }}>
                                <span>{extra.name}</span>
                                <span>
                                    {extra.price === 0
                                        ? 'Gratis'
                                        : money(extra.price)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Descuentos - detailed breakdown */}
            <div className='mt-6'>
                <SectionLabel>Descuentos aplicados</SectionLabel>
                {lines.length === 0 ? (
                    <div className='text-[13px]' style={{ color: MUTED }}>
                        Sin descuentos
                    </div>
                ) : (
                    <div className='overflow-hidden rounded-md border'>
                        <div
                            className='flex items-center justify-between px-2 py-1.5 text-[13px] font-semibold'
                            style={{ backgroundColor: LIGHT }}>
                            <span>Concepto</span>
                            <span>Monto</span>
                        </div>
                        {lines.map((line) => (
                            <div
                                key={line.key}
                                className='border-t px-2 py-1.5 text-[13px]'
                                style={{ borderColor: BORDER }}>
                                <div className='flex items-center justify-between'>
                                    <span>{line.name}</span>
                                    <span className='text-destructive'>
                                        - {money(line.amount)}
                                    </span>
                                </div>
                                {line.endsAt ? (
                                    <div
                                        className='text-xs'
                                        style={{ color: MUTED }}>
                                        Disponible hasta{' '}
                                        {formatDateLong(line.endsAt)}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                        <div
                            className='flex items-center justify-between border-t px-2 py-1.5 text-[13px] font-semibold'
                            style={{
                                borderColor: BORDER,
                                backgroundColor: LIGHT
                            }}>
                            <span>Total descuentos</span>
                            <span className='text-destructive'>
                                - {money(totals.discount)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Resumen */}
            <div className='mt-6'>
                <SectionLabel>Resumen de costos</SectionLabel>
                <div className='overflow-hidden rounded-md border'>
                    <CostRow label='Programa' value={money(totals.course)} />
                    <CostRow
                        label='Alojamiento'
                        value={money(totals.accommodation)}
                    />
                    <CostRow label='Extras' value={money(totals.extras)} />
                    <CostRow
                        label='Subtotal'
                        value={money(totals.subtotal)}
                        bold
                    />
                    {lines.length > 0 && (
                        <CostRow
                            label={
                                <>
                                    Descuento
                                    <span
                                        className='ml-2 text-xs font-normal'
                                        style={{ color: MUTED }}>
                                        {lines.map((d) => d.name).join(' / ')}
                                    </span>
                                </>
                            }
                            value={`- ${money(totals.discount)}`}
                            bold
                        />
                    )}
                    <div className='border-t'>
                        <CostRow
                            label='TOTAL'
                            value={money(totals.total)}
                            total
                        />
                    </div>
                </div>
            </div>

            {/* S Travel info */}
            <div className='mt-6'>
                <SectionLabel>{company.companyName}</SectionLabel>
                <div className='grid gap-x-4 text-[13px] sm:grid-cols-2'>
                    <LabelValue label='Email' value={company.email} />
                    <LabelValue label='Facebook' value={company.facebook} />
                    <LabelValue label='Instagram' value={company.instagram} />
                    <LabelValue label='Dirección' value={company.address} />
                </div>
            </div>

            <div className='my-4'>
                <Line />
            </div>

            <div>
                <div
                    className='text-[11px] font-semibold uppercase tracking-wider'
                    style={{ color: ACCENT_DARK }}>
                    Términos y condiciones
                </div>
                <p className='mt-1 text-xs' style={{ color: MUTED }}>
                    {company.terms ||
                        'La presente cotización tiene una vigencia determinada. Los precios y condiciones están sujetos a las condiciones indicadas en la cotización.'}
                </p>
            </div>
        </div>
    )
}
