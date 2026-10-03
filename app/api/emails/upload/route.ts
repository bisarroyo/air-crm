import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth as authLib } from '@/lib/auth'
import { cloudinaryConfig } from '@/lib/email/cloudinary'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp'
])

/**
 * Sube la imagen a Cloudinary y devuelve la URL pública para insertarla en el
 * correo. La subida pasa por aquí (y no desde el navegador) para que el
 * `api_secret` nunca quede expuesto en el cliente.
 *
 * Si Cloudinary no está configurado devuelve 501 y la interfaz esconde el botón
 * de subir imagen, dejando solo la opción de pegar una URL.
 */
export async function POST(request: Request) {
    const session = await authLib.api.getSession({ headers: await headers() })
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = cloudinaryConfig()
    if (!config) {
        return NextResponse.json(
            {
                error: 'Cloudinary no está configurado',
                code: 'cloudinary_disabled'
            },
            { status: 501 }
        )
    }

    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return NextResponse.json({ error: 'Envío inválido' }, { status: 400 })
    }

    const file = form.get('file')

    if (!(file instanceof File)) {
        return NextResponse.json(
            { error: 'No se recibió ninguna imagen' },
            { status: 400 }
        )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
            { error: 'Solo se permiten PNG, JPG, GIF o WEBP' },
            { status: 400 }
        )
    }

    if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
            { error: 'La imagen no puede pesar más de 5 MB' },
            { status: 400 }
        )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const body = new FormData()
    body.append('file', new Blob([buffer]), file.name || 'imagen')
    // Carpeta del CRM para poder limpiar o listar las imágenes desde Cloudinary.
    body.append('folder', 'air-crm/emails')

    const auth = Buffer.from(
        `${config.apiKey}:${config.apiSecret}`
    ).toString('base64')

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
            {
                method: 'POST',
                headers: { Authorization: `Basic ${auth}` },
                body
            }
        )

        const payload = (await response.json()) as {
            secure_url?: string
            error?: { message?: string }
        }

        if (!response.ok || !payload.secure_url) {
            return NextResponse.json(
                {
                    error:
                        payload.error?.message ||
                        'No se pudo subir la imagen a Cloudinary'
                },
                { status: 502 }
            )
        }

        return NextResponse.json({ url: payload.secure_url })
    } catch {
        return NextResponse.json(
            { error: 'No se pudo conectar con Cloudinary' },
            { status: 502 }
        )
    }
}