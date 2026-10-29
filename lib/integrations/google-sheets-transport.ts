export class SheetsError extends Error {
    constructor(message: string) { super(message); this.name = 'SheetsError' }
}

export function normalizeAppsScriptUrl(raw: string): string {
    let url: URL
    try { url = new URL(raw.trim()) } catch { throw new SheetsError('URL de Apps Script inválida.') }
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' ||
        url.port || url.username || url.password || url.search || url.hash ||
        !/^\/(?:a\/[^/]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) {
        throw new SheetsError('Usá la URL HTTPS de Google Apps Script que termina en /exec.')
    }
    return url.toString()
}

interface Payload {
    secret: string
    protocol: 2
    organizationId: string
    action: 'ping' | 'upsert' | 'delete'
    version?: number
    lead?: Record<string, string>
}
interface Result {
    action: string
    applied?: boolean
    reason?: string
    sheet?: string
    rows?: number
}

/** One deadline covers redirects AND response body. Never forward the secret
 * on a redirect. ContentService's documented response redirect is a GET. */
export async function postToAppsScript(url: string, payload: Payload, deadline = Date.now() + 15_000): Promise<Result> {
    const controller = new AbortController()
    const remaining = Math.min(15_000, deadline - Date.now())
    if (remaining <= 0) throw new SheetsError('Se agotó el tiempo disponible; se reintentará.')
    const timeout = setTimeout(() => controller.abort(), remaining)
    try {
        let current = new URL(normalizeAppsScriptUrl(url))
        for (let redirects = 0; redirects <= 4; redirects++) {
            const response = await fetch(current, {
                method: redirects === 0 ? 'POST' : 'GET',
                headers: redirects === 0 ? { 'Content-Type': 'application/json' } : undefined,
                body: redirects === 0 ? JSON.stringify(payload) : undefined,
                redirect: 'manual', cache: 'no-store', signal: controller.signal
            })
            if ([301, 302, 303].includes(response.status)) {
                const location = response.headers.get('location')
                await response.body?.cancel()
                if (!location) throw new SheetsError('Redirección de Google inválida.')
                const next = new URL(location, current)
                if (next.protocol !== 'https:' || next.hostname !== 'script.googleusercontent.com' ||
                    next.port || next.username || next.password) throw new SheetsError('Destino de redirección no permitido.')
                current = next
                continue
            }
            if (!response.ok) {
                await response.body?.cancel()
                throw new SheetsError(`Google Apps Script respondió HTTP ${response.status}.`)
            }
            const reader = response.body?.getReader()
            if (!reader) throw new SheetsError('Respuesta vacía de Google Apps Script.')
            let text = ''
            let size = 0
            const decoder = new TextDecoder()
            while (true) {
                const chunk = await reader.read()
                if (chunk.done) break
                size += chunk.value.byteLength
                if (size > 32_768) { await reader.cancel(); throw new SheetsError('Respuesta de Google demasiado grande.') }
                text += decoder.decode(chunk.value, { stream: true })
            }
            text += decoder.decode()
            let result: Record<string, unknown>
            try { result = JSON.parse(text) } catch { throw new SheetsError('Google Apps Script no devolvió JSON válido.') }
            if (!result || typeof result !== 'object' || result.protocol !== 2 || result.action !== payload.action) {
                throw new SheetsError('Respuesta incompatible. Publicá la versión actual de Apps Script.')
            }
            if (result.ok !== true) {
                // Endpoint errors can contain arbitrary content, including echoed secrets.
                const messages: Record<string, string> = {
                    UNAUTHORIZED: 'Clave secreta incorrecta.',
                    ORGANIZATION_MISMATCH: 'La hoja pertenece a otra organización.',
                    NOT_CONFIGURED: 'Configurá API_SECRET, ORGANIZATION_ID y SPREADSHEET_ID en Apps Script.',
                    BUSY: 'La hoja está ocupada; se reintentará.',
                    MIGRATION_REQUIRED: 'Archivá la pestaña Leads anterior y creá una vacía para iniciar el protocolo v2.',
                    LAYOUT_MISMATCH: 'La hoja tiene otros campos u otro orden de columnas. Archivá la pestaña Leads, creá una nueva y volvé a sincronizar con el código actualizado.'
                }
                throw new SheetsError(messages[String(result.code)] ?? 'Google Apps Script rechazó la operación; revisá la implementación.')
            }
            if (result.organizationId !== payload.organizationId) throw new SheetsError('Organización inesperada en la respuesta.')
            if (payload.action === 'ping') {
                if (result.sheet !== 'Leads' || !Number.isSafeInteger(result.rows) || Number(result.rows) < 0) {
                    throw new SheetsError('La hoja no confirmó su disponibilidad.')
                }
            } else if (result.id !== payload.lead?.id || result.version !== payload.version ||
                !(result.applied === true || (result.applied === false && ['stale', 'duplicate'].includes(String(result.reason))))) {
                throw new SheetsError('Google Apps Script no confirmó la operación solicitada.')
            }
            return result as unknown as Result
        }
        throw new SheetsError('Demasiadas redirecciones de Google Apps Script.')
    } catch (error) {
        if (error instanceof SheetsError) throw error
        throw new SheetsError(controller.signal.aborted ? 'Google Apps Script no respondió a tiempo.' : 'No se pudo conectar con Google Apps Script.')
    } finally { clearTimeout(timeout) }
}
