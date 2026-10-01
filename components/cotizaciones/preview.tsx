'use client'

import {
    formatDateLong,
    formatMoneyCompact,
    quotationIncludes,
    splitEvenly,
    accommodationSummary,
    companyContactRows,
    type QuotationData,
    type Currency
} from '@/lib/cotizaciones/shared'
import { computeDiscountLines } from '@/lib/cotizaciones/pricing'

const ACCENT = '#0F766E'
const ACCENT_DARK = '#134E4A'
const TEXT = '#111827'
const MUTED = '#6B7280'
const BORDER = '#E5E7EB'
const LIGHT = '#F0FDFA'
const DANGER = '#DC2626'

/** Anchos de columna del cuadro de alojamiento, en % (mismos que el PDF). */
const ACCOMMODATION_COLUMNS = '55.3fr 11.1fr 16.8fr 16.8fr'
const ACCOMMODATION_ALIGN = ['left', 'center', 'right', 'right'] as const

type LabelValueRow = { label: string; value: string }

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            className='mb-1 text-[13px] font-semibold uppercase tracking-wider'
            style={{ color: ACCENT_DARK }}>
            {children}
        </div>
    )
}

function LabelValueTable({
    rows,
    labelWidth = '22%'
}: {
    rows: LabelValueRow[]
    labelWidth?: string
}) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `${labelWidth} 1fr` }}>
            {rows.map((row) => (
                <div key={row.label} className='contents'>
                    <div
                        className='pr-1 py-[3px] text-[12px]'
                        style={{ color: MUTED }}>
                        {row.label}
                    </div>
                    <div
                        className='py-[3px] text-[13px]'
                        style={{ color: TEXT }}>
                        {row.value}
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Filas label/value en columnas parejas, igual que en el PDF. */
function LabelValueColumns({ rows }: { rows: LabelValueRow[] }) {
    const columns = splitEvenly(rows, 2)
    const visible = columns.filter((column) => column.length > 0)

    return (
        <div
            className='grid gap-x-3'
            style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
            {columns.map((column, index) => (
                <div key={index}>
                    <LabelValueTable rows={column} />
                </div>
            ))}
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
    danger,
    total,
    detail
}: {
    label: React.ReactNode
    value: string
    bold?: boolean
    danger?: boolean
    total?: boolean
    detail?: string
}) {
    const cell = (children: React.ReactNode, right = false) => (
        <span
            className={`${total ? 'text-[15px] font-semibold' : 'text-[13px]'} ${bold || total ? 'font-semibold' : ''}`}
            style={{
                color: total ? '#fff' : danger ? DANGER : TEXT,
                textAlign: right ? 'right' : 'left'
            }}>
            {children}
        </span>
    )

    return (
        <div className='px-2 py-[7px]'>
            {detail ? (
                <div
                    className='text-[10px]'
                    style={{ color: MUTED }}>
                    {detail}
                </div>
            ) : (
                <div className='flex items-center justify-between'>
                    {cell(label)}
                    {cell(value, true)}
                </div>
            )}
        </div>
    )
}

function CostTable({
    header,
    rows
}: {
    header?: { label: string; value: string }
    rows: React.ReactNode[]
}) {
    return (
        <div
            className='overflow-hidden rounded-md border'
            style={{ borderColor: BORDER }}>
            {header && (
                <div
                    className='flex items-center justify-between border-b px-2 py-[7px] text-[13px] font-semibold'
                    style={{ backgroundColor: LIGHT, borderColor: BORDER }}>
                    <span>{header.label}</span>
                    <span>{header.value}</span>
                </div>
            )}
            {rows}
        </div>
    )
}

/** Cuadro horizontal de alojamiento, con la misma información que el PDF. */
function AccommodationBox({ rows }: { rows: LabelValueRow[] }) {
    return (
        <div
            className='overflow-hidden rounded-md border'
            style={{ borderColor: BORDER }}>
            <div
                className='grid'
                style={{ gridTemplateColumns: ACCOMMODATION_COLUMNS }}>
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className='px-2 py-[9px] text-[11px] font-bold'
                        style={{ backgroundColor: LIGHT, color: MUTED }}>
                        {row.label}
                    </div>
                ))}
            </div>
            <div
                className='grid border-t'
                style={{
                    gridTemplateColumns: ACCOMMODATION_COLUMNS,
                    borderColor: BORDER
                }}>
                {rows.map((row, index) => (
                    <div
                        key={row.label}
                        className={`px-2 py-[9px] ${index === rows.length - 1 ? 'text-[14px] font-semibold' : 'text-[13px]'}`}
                        style={{
                            color: TEXT,
                            textAlign: ACCOMMODATION_ALIGN[index] ?? 'left'
                        }}>
                        {row.value}
                    </div>
                ))}
            </div>
        </div>
    )
}

/** Lista con viñetas en columnas parejas, igual que el PDF. */
function BulletColumns({ items }: { items: string[] }) {
    const columns = splitEvenly(items, 2)
    const visible = columns.filter((column) => column.length > 0)

    return (
        <div
            className='grid gap-x-3'
            style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
            {columns.map((column, index) => (
                <ul key={index} className='list-none p-0'>
                    {column.map((item) => (
                        <li key={item} className='py-[3px] text-[13px]'>
                            •&nbsp;&nbsp;{item}
                        </li>
                    ))}
                </ul>
            ))}
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
    const currency: Currency = data.currency
    const money = (amount: number) => formatMoneyCompact(amount, currency)
    const company = data.company
    const totals = data.totals
    const lines = computeDiscountLines(data)
    const includes = quotationIncludes(data)
    const contactRows = companyContactRows(company)

    return (
        <div
            className='mx-auto w-full max-w-6xl rounded-xl border bg-white p-6 shadow-sm sm:p-8 dark:bg-white'
            style={{ color: TEXT }}>
            {/* Header */}
            <div className='flex items-start justify-between gap-4'>
                <div>
                    {company.logo?.startsWith('data:') ? (
                        <img
                            src={company.logo}
                            alt={company.companyName}
                            className='w-full max-w-[190px] object-contain'
                        />
                    ) : (
                        <div
                            className='text-[20px] font-bold'
                            style={{ color: ACCENT_DARK }}>
                            {company.companyName}
                        </div>
                    )}
                </div>
                <div className='text-right'>
                    <div
                        className='text-[29px] font-bold leading-tight'
                        style={{ color: ACCENT }}>
                        COTIZACIÓN
                    </div>
                    <div className='mt-1 text-[16px] font-semibold'>
                        N.º {number}
                    </div>
                    <div
                        className='mt-2 text-[11px]'
                        style={{ color: MUTED }}>
                        Fecha de emisión: {formatDateLong(data.issueDate)}
                    </div>
                    <div className='text-[11px]' style={{ color: MUTED }}>
                        Válida hasta: {formatDateLong(data.validUntil)}
                    </div>
                </div>
            </div>

            <div className='my-4'>
                <Line strong />
            </div>

            {/* Asesor + Cliente */}
            <div className='grid gap-4 sm:grid-cols-[44%_62%] sm:justify-between'>
                <div>
                    <SectionLabel>Asesor</SectionLabel>
                    <LabelValueTable
                        labelWidth='30%'
                        rows={[
                            {
                                label: 'Nombre',
                                value: data.advisor.name || company.advisorName || '—'
                            },
                            {
                                label: 'Email',
                                value:
                                    data.advisor.email ||
                                    company.advisorEmail ||
                                    '—'
                            },
                            { label: 'Teléfono', value: company.phone || '—' },
                            { label: 'WhatsApp', value: company.whatsapp || '—' }
                        ]}
                    />
                </div>
                <div>
                    <SectionLabel>Datos del cliente</SectionLabel>
                    <LabelValueTable
                        rows={[
                            { label: 'Cliente', value: data.client.name || '—' },
                            { label: 'Teléfono', value: data.client.phone || '—' },
                            { label: 'Email', value: data.client.email || '—' },
                            { label: 'País', value: data.client.country || '—' }
                        ]}
                    />
                </div>
            </div>

            {/* Programa */}
            {data.program && (
                <div className='mt-6'>
                    <SectionLabel>Programa</SectionLabel>
                    <div className='text-[17px] font-bold'>
                        {data.program.name || '—'}
                    </div>
                </div>
            )}

            {data.course && (
                <div className='mt-3'>
                    <LabelValueTable
                        rows={[
                            {
                                label: 'Escuela',
                                value: data.course.schoolName || '—'
                            },
                            { label: 'Curso', value: data.course.name || '—' },
                            {
                                label: 'Horario',
                                value: data.course.scheduleName || '—'
                            },
                            {
                                label: 'Duración',
                                value: `${data.course.weeks} semanas · ${data.course.hoursPerWeek} horas/semana`
                            }
                        ]}
                    />
                </div>
            )}

            {/* Incluye */}
            {includes.length > 0 && (
                <div className='mt-6'>
                    <SectionLabel>Incluye</SectionLabel>
                    <BulletColumns items={includes} />
                </div>
            )}

            {/* Alojamiento */}
            <div className='mt-6'>
                <SectionLabel>Alojamiento</SectionLabel>
                {data.accommodation.included ? (
                    <AccommodationBox
                        rows={accommodationSummary(
                            data.accommodation,
                            totals.accommodation,
                            currency
                        )}
                    />
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
                    <CostTable
                        header={{ label: 'Concepto', value: 'Monto' }}
                        rows={data.extras.map((extra) => (
                            <div
                                key={extra.key}
                                className='border-t'
                                style={{ borderColor: BORDER }}>
                                <CostRow
                                    label={extra.name}
                                    value={
                                        extra.price === 0
                                            ? 'Gratis'
                                            : money(extra.price)
                                    }
                                />
                            </div>
                        ))}
                    />
                )}
            </div>

            {/* Descuentos aplicados */}
            {lines.length > 0 && (
                <div className='mt-6'>
                    <SectionLabel>Descuentos aplicados</SectionLabel>
                    <CostTable
                        header={{ label: 'Concepto', value: 'Monto' }}
                        rows={[
                            ...lines.map((line) => (
                                <div
                                    key={line.key}
                                    className='border-t'
                                    style={{ borderColor: BORDER }}>
                                    <CostRow
                                        label={line.name}
                                        value={`- ${money(line.amount)}`}
                                        bold
                                        danger
                                    />
                                    {line.endsAt ? (
                                        <div className='-mt-1 px-2 pb-[7px]'>
                                            <CostRow
                                                label=''
                                                value=''
                                                detail={`Disponible hasta ${formatDateLong(
                                                    line.endsAt
                                                )}`}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            )),
                            <div
                                key='total-descuentos'
                                className='border-t'
                                style={{ borderColor: BORDER }}>
                                <CostRow
                                    label='Total descuentos'
                                    value={`- ${money(totals.discount)}`}
                                    bold
                                    danger
                                />
                            </div>
                        ]}
                    />
                </div>
            )}

            {/* Resumen de costos */}
            <div className='mt-6'>
                <SectionLabel>Resumen de costos</SectionLabel>
                <CostTable
                    rows={[
                        <div key='programa' className='border-t' style={{ borderColor: BORDER }}>
                            <CostRow
                                label='Programa'
                                value={money(totals.course)}
                            />
                        </div>,
                        <div key='alojamiento' className='border-t' style={{ borderColor: BORDER }}>
                            <CostRow
                                label='Alojamiento'
                                value={money(totals.accommodation)}
                            />
                        </div>,
                        <div key='extras' className='border-t' style={{ borderColor: BORDER }}>
                            <CostRow label='Extras' value={money(totals.extras)} />
                        </div>,
                        <div key='subtotal' className='border-t' style={{ borderColor: BORDER }}>
                            <CostRow
                                label='Subtotal'
                                value={money(totals.subtotal)}
                                bold
                            />
                        </div>,
                        ...(lines.length > 0
                            ? [
                                  <div
                                      key='descuento'
                                      className='border-t'
                                      style={{ borderColor: BORDER }}>
                                      <CostRow
                                          label='Descuento'
                                          value={`- ${money(totals.discount)}`}
                                          bold
                                      />
                                  </div>
                              ]
                            : []),
                        <div key='total' className='border-t' style={{ borderColor: BORDER }}>
                            <CostRow
                                label='TOTAL'
                                value={money(totals.total)}
                                total
                            />
                        </div>
                    ]}
                />
            </div>

            {/* Contacto de la empresa */}
            <div className='mt-6'>
                <SectionLabel>
                    {company.companyName || 'S Travel Costa Rica'}
                </SectionLabel>
                <LabelValueColumns rows={contactRows} />
            </div>

            <div className='my-4'>
                <Line />
            </div>

            <div>
                <SectionLabel>Términos y condiciones</SectionLabel>
                <p className='text-[11px] leading-relaxed' style={{ color: MUTED }}>
                    {company.terms ||
                        'La presente cotización tiene una vigencia determinada. Los precios y condiciones están sujetos a las condiciones indicadas en la cotización.'}
                </p>
            </div>
        </div>
    )
}