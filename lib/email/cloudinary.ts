/**
 * Configuración opcional de Cloudinary para subir imágenes desde el editor de
 * correos. Se resuelve solo en el servidor: el `api_secret` nunca llega al
 * navegador. Si faltan variables, el editor esconde "Subir imagen" y solo deja
 * pegar una URL.
 */
export type CloudinaryConfig = {
    cloudName: string
    apiKey: string
    apiSecret: string
}

export function cloudinaryConfig(): CloudinaryConfig | null {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()
    if (!cloudName || !apiKey || !apiSecret) return null
    return { cloudName, apiKey, apiSecret }
}

export const isCloudinaryConfigured = () => cloudinaryConfig() !== null