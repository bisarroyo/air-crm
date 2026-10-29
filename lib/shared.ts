import type { ReadonlyURLSearchParams } from 'next/navigation'

/**
 * Devuelve una ruta interna segura para volver después de iniciar sesión.
 * Se rechazan URLs absolutas, protocol-relative (`//`) y variantes con
 * backslashes para evitar redirecciones abiertas.
 */
export const getCallbackURL = (
    queryParams: ReadonlyURLSearchParams
): string => {
    const callbackUrl = queryParams.get('callbackUrl')
    if (!callbackUrl) return '/'

    const value = callbackUrl.trim()
    if (!value.startsWith('/')) return '/'
    if (value.startsWith('//') || value.includes('\\')) return '/'
    if (/[\u0000-\u001f\u007f]/.test(value)) return '/'
    if (value.startsWith('/signin') || value.startsWith('/signup')) return '/'

    return value
}
