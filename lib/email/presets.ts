/**
 * Plantillas predefinidas para no escribir el correo desde cero cada vez.
 *
 * Solo viven aquí asunto y cuerpo: los datos del cliente se siguen rellenando
 * con las variables `{{...}}` en el momento del envío, así que una plantilla
 * sirve para cualquier destinatario.
 */
export type EmailPreset = {
    id: string
    name: string
    description: string
    category: 'Seguimiento' | 'Promoción' | 'Cotización' | 'Relación'
    subject: string
    bodyHtml: string
}

/**
 * Solo etiquetas con formato básico (p, strong, ul, li, hr). Así el mismo HTML
 * funciona en modo código y sobrevive intacto al pasar por el editor visual,
 * que descarta los estilos inline.
 */
const SIGNATURE = `<hr>
<p>¡Cualquier duda por aquí!<br>
<strong>Equipo S Travel Costa Rica</strong><br>
Spanish programs in Costa Rica</p>`

export const EMAIL_PRESETS: EmailPreset[] = [
    {
        id: 'bienvenida',
        name: 'Bienvenida',
        description: 'Primer contacto con un lead nuevo. Cierra con la llamada.',
        category: 'Seguimiento',
        subject: 'Hola {{nombre_primero}}, hablemos de español',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Gracias por tu interés en aprender español en Costa Rica. Somos <strong>S Travel</strong> y nos encantaría contarte cómo trabajamos con personas de {{pais}} para que alcancen su meta en pocos meses.</p>
<p>¿Te parece si conversamos esta semana? Respondé este correo y coordinamos la hora que te acomode.</p>
${SIGNATURE}`
    },
    {
        id: 'promo-programas',
        name: 'Promo de programas',
        description: 'Anuncia horarios y tarifas de los programas de español.',
        category: 'Promoción',
        subject: 'Programas de español en Costa Rica: los más pedidos',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Estos son los programas que más eligieron este mes:</p>
<ul>
    <li><strong>Intensivo</strong> · 4 semanas, de lunes a viernes</li>
    <li><strong>Semintensivo</strong> · 8 semanas, mañanas o tardes</li>
    <li><strong>Inmersión con familia</strong> · programa a medida</li>
</ul>
<p>Los grupos son pequeños y las clases son en español desde el primer día, para que te veas hablando desde la primera semana.</p>
${SIGNATURE}`
    },
    {
        id: 'seguimiento-sin-respuesta',
        name: 'Seguimiento sin respuesta',
        description:
            'Segundo o tercer contacto cuando no contesta el primer email.',
        category: 'Seguimiento',
        subject: '¿Seguimos hablando, {{nombre_primero}}?',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Te escribí hace unos días para mostrarte los programas de español en Costa Rica, y sé que los correos a veces se pierden.</p>
<p>¿Sigue siendo algo que te interesa? Si el momento no es el mejor, decímelo y te escribo en unos meses. Si sí, con gusto te mando la cotización con los precios de tu caso desde {{pais}}.</p>
<p>Una respuesta de una línea me basta para saber cómo seguir.</p>
${SIGNATURE}`
    },
    {
        id: 'cotizacion-lista',
        name: 'Cotización lista',
        description:
            'Avisa que la cotización ya está disponible para revisar.',
        category: 'Cotización',
        subject: 'Tu cotización {{ultima_cotizacion}} está lista',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Tu cotización <strong>{{ultima_cotizacion}}</strong> ya está lista para que la revises.</p>
<p>Si querés ajustarla —fechas, intensidad, alojamiento o presupuesto— decímelo y la actualizo. También podemos agendar una videollamada para explicarte cada detalle.</p>
${SIGNATURE}`
    },
    {
        id: 'agradecimiento-visita',
        name: 'Agradecimiento',
        description: 'Gracias por la reunión o por responder el mensaje.',
        category: 'Relación',
        subject: 'Gracias por escribirnos, {{nombre_primero}}',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Muchas gracias por tomarte el tiempo de escribirnos y por la confianza de contarnos lo que buscás. Nos alegra tenerte en nuestra lista y vamos a seguir en contacto.</p>
<p>Cualquier cosa que necesites de Costa Rica —vuelos, alojamiento, traslados— también lo resolvemos nosotros.</p>
${SIGNATURE}`
    },
    {
        id: 'consejo-idioma',
        name: 'Consejo de español',
        description:
            'Tip corto de estudio para mantener el contacto sin vender.',
        category: 'Promoción',
        subject: 'Un tip para aprender español más rápido',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Un consejo corto que le sirve a casi todo el mundo: <strong>hablá desde el primer día</strong>, aunque no entiendas todo. El cerebro asume el contexto y en dos semanas ya estás entendiendo más de lo que creés.</p>
<p>Es justo lo que hacemos en clase: desde el día uno todo se habla en español, sin libros ni teoría.</p>
${SIGNATURE}`
    },
    {
        id: 'reactivacion',
        name: 'Reactivación',
        description: 'Reactiva leads antiguos con una promo de temporada.',
        category: 'Relación',
        subject: 'Volvió el interés en español, {{nombre_primero}}',
        bodyHtml: `<p>Hola <strong>{{nombre_primero}}</strong>,</p>
<p>Hace tiempo conversamos sobre aprender español y quiero volver a mencionártelo: abrimos nuevos grupos para el próximo inicio y tenemos condiciones para quienes ya nos escribieron antes.</p>
<p>¿Querés que te reserve un lugar o te mando la cotización con los precios de hoy?</p>
${SIGNATURE}`
    }
]

export const EMAIL_PRESET_CATEGORIES = [
    'Seguimiento',
    'Promoción',
    'Cotización',
    'Relación'
] as const

export function findPreset(id: string): EmailPreset | undefined {
    return EMAIL_PRESETS.find((preset) => preset.id === id)
}
/** Plantilla tal como viene de la base de datos. */
export type StoredEmailTemplate = {
    id: number
    name: string
    description: string | null
    category: EmailPreset['category']
    subject: string
    bodyHtml: string
    createdBy: string | null
    createdAt: string | number | null
    updatedAt: string | number | null
}
