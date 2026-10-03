import { formatMoneyCompact } from '@/lib/cotizaciones/shared'
import type { Currency } from '@/lib/cotizaciones/shared'
import type { TemplateVars } from './template'

export type RecipientContext = {
    name: string
    email: string | null
    phone: string | null
    country: string | null
    statusName: string | null
    priorityName: string | null
    tags: string[]
    advisorName: string | null
    lastQuotationNumber: string | null
    lastQuotationTotal: number | null
    lastQuotationCurrency: Currency | null
}

export function firstName(name: string): string {
    const trimmed = (name || '').trim()
    if (!trimmed) return ''
    return trimmed.split(/\s+/)[0]
}

export function buildTemplateVars(
    recipient: RecipientContext
): TemplateVars {
    const quotationTotal =
        recipient.lastQuotationTotal != null &&
        recipient.lastQuotationCurrency != null
            ? formatMoneyCompact(
                  recipient.lastQuotationTotal,
                  recipient.lastQuotationCurrency
              )
            : ''

    return {
        nombre: recipient.name || '',
        nombre_primero: firstName(recipient.name),
        email: recipient.email || '',
        telefono: recipient.phone || '',
        pais: recipient.country || '',
        estado: recipient.statusName || '',
        prioridad: recipient.priorityName || '',
        etiquetas: recipient.tags.join(', '),
        asesor: recipient.advisorName || '',
        ultima_cotizacion: recipient.lastQuotationNumber || '',
        total_cotizacion: quotationTotal
    }
}

/** Contexto de ejemplo para la vista previa cuando aún no hay destinatario real. */
export function sampleTemplateVars(): TemplateVars {
    return {
        nombre: 'Juan Carlos Pérez',
        nombre_primero: 'Juan',
        email: 'juan@correo.com',
        telefono: '+34 600 111 222',
        pais: 'España',
        estado: 'Contactado',
        prioridad: 'Alta',
        etiquetas: 'Europa, Virtual',
        asesor: 'María Fernández',
        ultima_cotizacion: 'ST-2026-0042',
        total_cotizacion: '€2 295'
    }
}