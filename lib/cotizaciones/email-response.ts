/** A proxy or an unhandled server error may return HTML or an empty body. */
export async function readQuotationEmailResponse<T>(
    response: Response,
    fallback: string
): Promise<T> {
    const body: unknown = await response.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error(`${fallback} (HTTP ${response.status}). El servidor no devolvió una respuesta válida.`)
    }
    if (!response.ok) {
        const error = 'error' in body && typeof body.error === 'string' ? body.error : fallback
        throw new Error(error)
    }
    return body as T
}
