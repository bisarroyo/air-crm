import pdfMake from 'pdfmake'
import vfsFonts from 'pdfmake/build/vfs_fonts'
import {
    formatMoneyCompact,
    formatDateLong,
    type QuotationData,
    type Currency
} from './shared'

const PRIMARY = '#0F766E'
const PRIMARY_DARK = '#134E4A'
const TEXT = '#111827'
const MUTED = '#6B7280'
const BORDER = '#E5E7EB'
const LIGHT = '#F0FDFA'
const DANGER = '#DC2626'

interface PdfRow {
    label: string
    value: string
    bold?: boolean
    fill?: boolean
    accent?: boolean
    danger?: boolean
    detail?: string
}

function initPdfMake() {
    const instance = pdfMake as unknown as {
        virtualfs: {
            writeFileSync(
                filename: string,
                content: string,
                options?: string
            ): void
        }
        setFonts: (fonts: Record<string, unknown>) => void
    }

    const files = [
        'Roboto-Regular.ttf',
        'Roboto-Medium.ttf',
        'Roboto-Italic.ttf',
        'Roboto-MediumItalic.ttf'
    ] as const

    for (const file of files) {
        const content = vfsFonts
            ? (vfsFonts as Record<string, string>)[file]
            : undefined
        if (typeof content === 'string') {
            try {
                instance.virtualfs.writeFileSync(file, content, 'base64')
            } catch {
                /* font may already be registered */
            }
        }
    }

    instance.setFonts({
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        }
    })
}

let initialized = false

export async function buildQuotationPdf(
    data: QuotationData,
    number: string
): Promise<Buffer> {
    if (!initialized) {
        initPdfMake()
        initialized = true
    }

    const doc = pdfMake.createPdf(buildDocDefinition(data, number))
    return doc.getBuffer()
}

function money(amount: number, currency: Currency): string {
    return formatMoneyCompact(amount, currency)
}

interface Node {
    [key: string]: unknown
    text?: string
    stack?: unknown[]
    columns?: unknown[]
    table?: unknown
    image?: string
    canvas?: unknown[]
}

function sectionLabel(text: string): Node {
    return {
        text: text.toUpperCase(),
        fontSize: 10,
        bold: true,
        color: PRIMARY_DARK,
        letterSpacing: 1,
        margin: [0, 0, 0, 4]
    }
}

function labelValueTable(rows: Array<[string, string]>): Node {
    return {
        layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 4,
            paddingTop: () => 1,
            paddingBottom: () => 1
        },
        table: {
            widths: ['22%', '78%'],
            body: rows.map(([label, value]) => [
                { text: label, color: MUTED, fontSize: 9 },
                { text: value || '—', fontSize: 9.5, color: TEXT }
            ])
        }
    }
}

const noBorderLayout = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0
}

function costTable(rows: PdfRow[]): Node {
    return {
        table: {
            widths: ['*', 90],
            body: rows.map((row) =>
                row.detail
                    ? [
                          {
                              text: row.detail,
                              colSpan: 2,
                              fontSize: 7.5,
                              color: MUTED,
                              margin: [0, 0, 0, 1]
                          },
                          {}
                      ]
                    : [
                          {
                              text: row.label,
                              fontSize: row.accent ? 12 : 9.5,
                              bold: row.bold || row.accent,
                              color: row.accent ? '#FFFFFF' : TEXT,
                              fillColor: row.accent
                                  ? PRIMARY
                                  : row.fill
                                    ? LIGHT
                                    : undefined,
                              margin: [0, 1, 0, 1]
                          },
                          {
                              text: row.value,
                              fontSize: row.accent ? 12 : 9.5,
                              bold: row.bold || row.accent,
                              color: row.accent
                                  ? '#FFFFFF'
                                  : row.danger
                                    ? DANGER
                                    : TEXT,
                              fillColor: row.accent
                                  ? PRIMARY
                                  : row.fill
                                    ? LIGHT
                                    : undefined,
                              alignment: 'right',
                              margin: [0, 1, 0, 1]
                          }
                      ]
            )
        },
        layout: {
            hLineWidth: (row: number) => (row === 0 ? 0.6 : 0.2),
            vLineWidth: () => 0,
            hLineColor: () => BORDER,
            paddingTop: () => 2,
            paddingBottom: () => 2,
            paddingLeft: () => 4,
            paddingRight: () => 4
        }
    }
}

export function buildDocDefinition(
    data: QuotationData,
    number: string
): Record<string, unknown> {
    const company = data.company
    const companyName = company.companyName || 'S Travel Costa Rica'
    const currency = data.currency
    const totals = data.totals
    const advisor = {
        name: data.advisor.name || company.advisorName || '—',
        email: data.advisor.email || company.advisorEmail || '—'
    }

    const headerLogo: Node = company.logo?.startsWith('data:')
        ? { image: company.logo as string, width: 140, fit: [140, 64] }
        : {
              text: companyName,
              bold: true,
              fontSize: 15,
              color: PRIMARY_DARK
          }

    const content: Node[] = []

    content.push({
        table: {
            widths: ['55%', '45%'],
            body: [
                [
                    { stack: [headerLogo], alignment: 'left' },
                    {
                        stack: [
                            {
                                text: 'COTIZACIÓN',
                                fontSize: 22,
                                bold: true,
                                color: PRIMARY,
                                alignment: 'right'
                            },
                            {
                                text: `N.º ${number}`,
                                fontSize: 12,
                                bold: true,
                                color: TEXT,
                                alignment: 'right',
                                margin: [0, 2, 0, 6]
                            },
                            {
                                text: `Fecha de emisión: ${formatDateLong(
                                    data.issueDate
                                )}`,
                                fontSize: 8.5,
                                color: MUTED,
                                alignment: 'right',
                                margin: [0, 1, 0, 0]
                            },
                            {
                                text: `Válida hasta: ${formatDateLong(
                                    data.validUntil
                                )}`,
                                fontSize: 8.5,
                                color: MUTED,
                                alignment: 'right',
                                margin: [0, 1, 0, 0]
                            }
                        ],
                        valign: 'middle'
                    }
                ]
            ]
        },
        layout: noBorderLayout,
        margin: [0, 0, 0, 6]
    })

    content.push({
        canvas: [
            {
                type: 'line',
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 2,
                lineColor: PRIMARY
            }
        ],
        margin: [0, 0, 0, 8]
    })

    content.push({
        columns: [
            {
                width: '38%',
                stack: [
                    sectionLabel('Asesor'),
                    labelValueTable([
                        ['Nombre', advisor.name],
                        ['Email', advisor.email]
                    ])
                ]
            },
            {
                width: '62%',
                stack: [
                    sectionLabel('Datos del cliente'),
                    labelValueTable([
                        ['Cliente', data.client.name || '—'],
                        ['Teléfono', data.client.phone || '—'],
                        ['Email', data.client.email || '—'],
                        ['País', data.client.country || '—']
                    ])
                ]
            }
        ],
        columnGap: 16,
        margin: [0, 0, 0, 8]
    })

    if (data.program) {
        content.push({
            stack: [
                sectionLabel('Programa'),
                {
                    text: data.program.name || '—',
                    fontSize: 13,
                    bold: true,
                    color: TEXT,
                    margin: [0, 0, 0, 6]
                }
            ],
            margin: [0, 0, 0, 6]
        })
    }

    if (data.course) {
        content.push({
            stack: [
                labelValueTable([
                    ['Escuela', data.course.schoolName || '—'],
                    ['Curso', data.course.name || '—'],
                    ['Horario', data.course.scheduleName || '—'],
                    [
                        'Duración',
                        `${data.course.weeks} semanas · ${data.course.hoursPerWeek} horas/semana`
                    ]
                ])
            ],
            margin: [0, 0, 0, 7]
        })
    }

    if (data.program && data.program.includes.length > 0) {
        content.push({
            stack: [
                sectionLabel('Incluye'),
                ...data.program.includes.map((item) => ({
                    text: `•  ${item}`,
                    fontSize: 9.5,
                    color: TEXT,
                    margin: [0, 1, 0, 1]
                }))
            ],
            margin: [0, 0, 0, 7]
        })
    }

    content.push({
        stack: [
            sectionLabel('Alojamiento'),
            data.accommodation.included
                ? labelValueTable([
                      ['Tipo', data.accommodation.name],
                      ['Semanas', String(data.accommodation.weeks)],
                      [
                          'Precio semanal',
                          money(data.accommodation.pricePerWeek, currency)
                      ],
                      ['Total', money(totals.accommodation, currency)]
                  ])
                : {
                      text: 'No incluye alojamiento',
                      fontSize: 9.5,
                      color: MUTED
                  }
        ],
        margin: [0, 0, 0, 7]
    })

    content.push({
        stack: [
            sectionLabel('Extras'),
            data.extras.length === 0
                ? { text: 'Sin extras', fontSize: 9.5, color: MUTED }
                : costTable([
                      { label: 'Concepto', value: 'Monto', bold: true, fill: true },
                      ...data.extras.map((extra) => ({
                          label: extra.name,
                          value:
                              extra.price === 0
                                  ? 'Gratis'
                                  : money(extra.price, currency)
                      }))
                  ])
        ],
        margin: [0, 0, 0, 7]
    })

    if (data.discounts.length > 0) {
        const discountRows: PdfRow[] = data.discounts.flatMap((discount) => [
            {
                label: discount.name,
                value: `- ${money(discount.amount, currency)}`,
                bold: true,
                danger: true
            },
            ...(discount.endsAt
                ? [
                      {
                          label: '',
                          value: '',
                          detail: `Disponible hasta ${formatDateLong(
                              discount.endsAt
                          )}`
                      }
                  ]
                : [])
        ])

        content.push({
            stack: [
                sectionLabel('Descuentos aplicados'),
                costTable([
                    {
                        label: 'Concepto',
                        value: 'Monto',
                        bold: true,
                        fill: true
                    },
                    ...discountRows
                ])
            ],
            margin: [0, 0, 0, 7]
        })
    }

    const summary: PdfRow[] = [
        { label: 'Programa', value: money(totals.course, currency) },
        { label: 'Alojamiento', value: money(totals.accommodation, currency) },
        { label: 'Extras', value: money(totals.extras, currency) },
        { label: 'Subtotal', value: money(totals.subtotal, currency), bold: true }
    ]

    if (data.discounts.length > 0) {
        summary.push({
            label: 'Descuento',
            value: `- ${money(totals.discount, currency)}`,
            bold: true
        })
    }

    summary.push({
        label: 'TOTAL',
        value: money(totals.total, currency),
        accent: true
    })

    content.push({
        stack: [sectionLabel('Resumen de costos'), costTable(summary)],
        margin: [0, 0, 0, 8]
    })

    const contactRows: Array<[string, string]> = [
        ['Teléfono', company.phone || '—'],
        ['WhatsApp', company.whatsapp || '—'],
        ['Email', company.email || '—'],
        ['Sitio web', company.website || '—'],
        ['Facebook', company.facebook || '—'],
        ['Instagram', company.instagram || '—'],
        ['Dirección', company.address || '—']
    ]

    const half = Math.ceil(contactRows.length / 2)

    content.push({
        stack: [sectionLabel(companyName),
            {
                columns: [
                    { width: '50%', stack: [labelValueTable(contactRows.slice(0, half))] },
                    { width: '50%', stack: [labelValueTable(contactRows.slice(half))] }
                ],
                columnGap: 12
            }
        ],
        margin: [0, 0, 0, 3]
    })

    const terms =
        company.terms ||
        'La presente cotización tiene una vigencia determinada. Los precios y condiciones están sujetos a las condiciones indicadas en la cotización.'

    content.push({
        canvas: [
            {
                type: 'line',
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 0.6,
                lineColor: BORDER
            }
        ],
        margin: [0, 6, 0, 4]
    })

    content.push({
        stack: [
            {
                text: 'TÉRMINOS Y CONDICIONES',
                fontSize: 9,
                bold: true,
                color: PRIMARY_DARK
            },
            {
                text: terms,
                fontSize: 8,
                color: MUTED,
                margin: [0, 3, 0, 0]
            }
        ]
    })

    return {
        pageSize: 'A4',
        pageMargins: [36, 26, 36, 40],
        info: {
            title: `Cotización ${number}`,
            author: companyName
        },
        defaultStyle: {
            font: 'Roboto',
            fontSize: 9.5,
            color: TEXT
        },
        content,
        footer: (currentPage: number, pageCount: number) => ({
            columns: [
                {
                    text: `${companyName}${company.website ? ` · ${company.website}` : ''}`,
                    alignment: 'left',
                    fontSize: 7.5,
                    color: MUTED,
                    margin: [36, 10, 0, 0]
                },
                {
                    text: `Página ${currentPage} de ${pageCount}`,
                    alignment: 'right',
                    fontSize: 7.5,
                    color: MUTED,
                    margin: [0, 10, 36, 0]
                }
            ]
        })
    } as Record<string, unknown>
}