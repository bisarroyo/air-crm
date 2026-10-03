/**
 * Motor de plantillas de las campañas de email.
 *
 * Las variables se escriben como {{nombre}} y se reemplazan por los datos del
 * cliente en el momento del envío (nunca se guarda el texto ya resuelto, así
 * que si un dato cambia el próximo envío usa el valor actual).
 *
 * En el cuerpo HTML los valores se escapan para que un nombre con `<` no rompa
 * el correo; el asunto es texto plano y solo se limpian los saltos de línea.
 */

export type TemplateVars = Record<string, string>

export type TemplateVariable = {
    token: string
    label: string
    group: 'Cliente' | 'CRM'
    sample: string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
    {
        token: '{{nombre}}',
        label: 'Nombre',
        group: 'Cliente',
        sample: 'Juan Carlos Pérez'
    },
    {
        token: '{{nombre_primero}}',
        label: 'Primer nombre',
        group: 'Cliente',
        sample: 'Juan'
    },
    {
        token: '{{email}}',
        label: 'Email',
        group: 'Cliente',
        sample: 'juan@correo.com'
    },
    {
        token: '{{telefono}}',
        label: 'Teléfono',
        group: 'Cliente',
        sample: '+34 600 111 222'
    },
    {
        token: '{{pais}}',
        label: 'País',
        group: 'Cliente',
        sample: 'España'
    },
    {
        token: '{{estado}}',
        label: 'Estado del lead',
        group: 'CRM',
        sample: 'Contactado'
    },
    {
        token: '{{prioridad}}',
        label: 'Prioridad',
        group: 'CRM',
        sample: 'Alta'
    },
    {
        token: '{{etiquetas}}',
        label: 'Etiquetas',
        group: 'CRM',
        sample: 'Europa, Virtual'
    },
    {
        token: '{{asesor}}',
        label: 'Asesor asignado',
        group: 'CRM',
        sample: 'María Fernández'
    },
    {
        token: '{{ultima_cotizacion}}',
        label: 'Número de la última cotización',
        group: 'CRM',
        sample: 'ST-2026-0042'
    },
    {
        token: '{{total_cotizacion}}',
        label: 'Total de la última cotización',
        group: 'CRM',
        sample: '€2 295'
    }
]

const VARIABLE_KEYS = new Set(
    TEMPLATE_VARIABLES.map((variable) =>
        variable.token.replace(/[{}]/g, '').toLowerCase()
    )
)

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

const EMPTY = ''

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** Reemplaza las variables en texto plano (asunto, preheader). */
export function renderTemplate(text: string, vars: TemplateVars): string {
    return text.replace(TOKEN_PATTERN, (match, rawKey: string) => {
        const key = rawKey.toLowerCase()
        if (!VARIABLE_KEYS.has(key)) return match
        return (vars[key] ?? EMPTY).replace(/\s+/g, ' ').trim()
    })
}

/** Reemplaza las variables escapando el valor para poder inyectarlo en HTML. */
export function renderTemplateHtml(html: string, vars: TemplateVars): string {
    return html.replace(TOKEN_PATTERN, (match, rawKey: string) => {
        const key = rawKey.toLowerCase()
        if (!VARIABLE_KEYS.has(key)) return match
        return escapeHtml(vars[key] ?? EMPTY)
    })
}

/** Variables presentes en el texto que el usuario escribió pero noReconocemos. */
export function unknownVariables(text: string): string[] {
    const found = new Set<string>()
    for (const match of text.matchAll(TOKEN_PATTERN)) {
        const key = match[1].toLowerCase()
        if (!VARIABLE_KEYS.has(key)) found.add(match[0])
    }
    return [...found]
}

/** Variables usadas, para mostrarlas como "chips" en el editor. */
export function usedVariables(text: string): string[] {
    const found = new Set<string>()
    for (const match of text.matchAll(TOKEN_PATTERN)) {
        const key = match[1].toLowerCase()
        if (VARIABLE_KEYS.has(key)) found.add(match[0])
    }
    return [...found]
}

const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\]+@[^\s@,;:<>()[\]\\]+\.[^\s@,;:<>()[\]\\]{2,}$/

export function isValidEmail(value: string | null | undefined): boolean {
    if (!value) return false
    const email = value.trim()
    if (email.length > 254) return false
    if (email.includes('..')) return false
    return EMAIL_PATTERN.test(email)
}

/**
 * Divide el campo de texto en una lista normalizada de direcciones. Acepta
 * comas, punto y coma, saltos de línea y espacios.
 */
export function parseAddressList(value: string | null | undefined): string[] {
    if (!value) return []
    const seen = new Set<string>()
    const addresses: string[] = []
    for (const raw of value.split(/[,;\n\r]+/)) {
        const email = raw.trim().replace(/^<|>$/g, '')
        if (!email) continue
        const key = email.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        addresses.push(email)
    }
    return addresses
}

export function invalidAddresses(value: string | null | undefined): string[] {
    return parseAddressList(value).filter((email) => !isValidEmail(email))
}

/** Quita el HTML para generar la alternativa de texto plano del correo. */
export function htmlToText(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\/?(p|div|tr|li|h[1-6]|table|br|section)\b[^>]*>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

/**
 * Envuelve el contenido en una estructura de tabla, que es la única forma que
 * respeta el ancho en Outlook y Gmail. El editor visual también pasa por aquí
 * para que ambos modos se vean iguales en el cliente de correo.
 */
export function wrapEmailHtml(innerHtml: string): string {
    const content = innerHtml.trim()
    return [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="color-scheme" content="light">',
        '</head>',
        '<body style="margin:0;padding:0;background:#f3f4f6;',
        '-webkit-text-size-adjust:100%;">',
        '<div style="display:none;max-height:0;overflow:hidden;',
        'opacity:0;">&nbsp;</div>',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"',
        ' border="0" style="background:#f3f4f6;">',
        '<tr>',
        '<td align="center" style="padding:24px 12px;">',
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0"',
        ' border="0" style="width:100%;max-width:600px;background:#ffffff;',
        'border-radius:8px;">',
        `<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;`,
        `font-size:15px;line-height:1.6;color:#111827;">${content}</td></tr>`,
        '</table>',
        '</td>',
        '</tr>',
        '</table>',
        '</body>',
        '</html>'
    ].join('')
}
const TEMPLATE_CATEGORIES: readonly string[] = [
    'Seguimiento',
    'Promoción',
    'Cotización',
    'Relación'
]

/**
 * Valida el alta/edición de una plantilla guardada. Devuelve el mensaje de
 * error o `null` si está bien.
 */
export function validateTemplateInput(
    input: Record<string, unknown>
): string | null {
    const name = String(input.name ?? '').trim()
    const subject = String(input.subject ?? '').trim()
    const bodyHtml = String(input.bodyHtml ?? '').trim()

    if (!name) return 'El nombre de la plantilla es obligatorio'
    if (name.length > 120) return 'El nombre es demasiado largo'
    if (!subject) return 'El asunto es obligatorio'
    if (!bodyHtml) return 'El mensaje no puede estar vacío'

    const category = String(input.category ?? '')
    if (category && !TEMPLATE_CATEGORIES.includes(category)) {
        return 'Categoría inválida'
    }

    return null
}
