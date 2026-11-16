/** Keep database/SMTP internals out of the response, including nested causes. */
export async function withQuotationEmailErrors(operation: () => Promise<Response>): Promise<Response> {
    try {
        return await operation()
    } catch (error) {
        let cause: unknown = error
        const seen = new Set<unknown>()
        while (cause instanceof Error && !seen.has(cause)) {
            seen.add(cause)
            if (/no such table:\s*[`"']?quotation_email_(settings|deliveries)/i.test(cause.message)) {
                return Response.json({
                    error: 'Los ajustes de correo todavía no están disponibles. El administrador debe aplicar la migración de email de cotizaciones.',
                    code: 'EMAIL_SCHEMA_MISSING'
                }, { status: 503 })
            }
            cause = cause.cause
        }
        return Response.json({
            error: 'No se pudo completar la operación de correo. Si estabas enviando, comprueba el resultado antes de volver a intentarlo.',
            code: 'QUOTATION_EMAIL_ERROR'
        }, { status: 500 })
    }
}
