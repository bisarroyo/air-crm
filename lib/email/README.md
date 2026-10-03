# Envío de correos (campañas masivas)

## Variables de entorno

### SMTP (obligatorio para enviar)

| Variable             | Ejemplo                    | Notas                                                          |
| -------------------- | -------------------------- | -------------------------------------------------------------- |
| `SMTP_HOST`          | `smtp.office365.com`       | Servidor SMTP del proveedor                                    |
| `SMTP_PORT`          | `587`                      | 465 si `SMTP_SECURE=true`, 587 para STARTTLS                  |
| `SMTP_SECURE`        | `false`                    | `true` solo para conexiones con TLS implícito (puerto 465)     |
| `SMTP_USER`          | `crm@empresa.com`          | Usuario de autenticación                                      |
| `SMTP_PASS`          | `clave-de-la-cuenta`       | Contraseña o clave de aplicación                               |
| `SMTP_FROM_NAME`     | `S Travel Costa Rica`      | Nombre que ven los clientes                                   |
| `SMTP_FROM_ADDRESS`  | `crm@empresa.com`          | Remitente; muchos proveedores exigen que coincida con `SMTP_USER` |
| `SMTP_BCC`           | `respaldo@empresa.com`     | Opcional. Copia oculta por defecto de todas las campañas        |

Si faltan `SMTP_HOST`, `SMTP_USER` o `SMTP_PASS`, la pantalla muestra un aviso
y bloquea el envío en vez de fallar a mitad de la campaña.

### Cloudinary (opcional, para subir imágenes)

| Variable               | Notas                                                    |
| ---------------------- | -------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud                                        |
| `CLOUDINARY_API_KEY`   | API key                                                 |
| `CLOUDINARY_API_SECRET`| Se usa solo en el servidor; nunca llega al navegador    |

Sin estas tres variables el editor esconde **Subir imagen** y solo permite pegar
una URL. La subida se hace por `POST /api/emails/upload` para no exponer el
`api_secret`; las imágenes quedan en la carpeta `air-crm/emails`.

## Variables disponibles en el mensaje

Cliente: `{{nombre}}`, `{{nombre_primero}}`, `{{email}}`, `{{telefono}}`,
`{{pais}}`.
CRM: `{{estado}}`, `{{prioridad}}`, `{{etiquetas}}`, `{{asesor}}`,
`{{ultima_cotizacion}}`, `{{total_cotizacion}}`.

Se renderizan en el asunto y en el cuerpo (visual o HTML). Una variable
desconocida bloquea el envío para no mandar texto literal.

## Cómo se envían (Vercel)

Cada request de Vercel tiene un límite de tiempo, así que **no** se envía todo
de una:

1. `POST /api/emails/campaigns` crea la campaña y una fila por destinatario.
   Los que no tienen email válido quedan como `skipped`.
2. El navegador llama `POST /api/emails/campaigns/:id` con
   `{ action: 'send', batchSize: 5 }` en bucle, con 1 s de pausa entre lotes.
3. Cada lote marca `sent` / `failed` recipient por recipient.

Como el resultado se guarda en la base, cerrar la pestaña no pierde lo ya
enviado: se puede continuar después desde **Historial**, igual que reintentar los
fallidos con `{ action: 'retry' }`.

Límite: 500 destinatarios por campaña (`CAMPAIGN_MAX_RECIPIENTS`) y 20 por lote
(`MAX_BATCH_SIZE`).

## Plantillas guardadas

La pestaña **Plantillas** (y el selector de la pestaña *Nuevo envío*) leen de la
tabla `email_templates`, no del código, así que lo que se agrega desde la
interfaz queda disponible para todos.

| Método | Ruta                             | Qué hace                       |
| ------ | -------------------------------- | ------------------------------ |
| GET    | `/api/emails/templates`          | Lista agrupada por categoría   |
| POST   | `/api/emails/templates`          | Crear plantilla                |
| PUT    | `/api/emails/templates`          | Importar las N plantillas base  |
| PUT    | `/api/emails/templates/:id`      | Editar plantilla               |
| DELETE | `/api/emails/templates/:id`      | Eliminar plantilla             |

El import es idempotente: se salta las que ya existen con el mismo nombre, así
que se puede volver a pulsar sin duplicar.

Categorías disponibles (columna `category` con check en la app):
`Seguimiento`, `Promoción`, `Cotización`, `Relación`.

Las plantillas base viven en `lib/email/presets.ts` y solo se usan como fuente
del import.

## Permisos

- Admin: cualquier cliente y cualquier campaña.
- Asesores: solo clientes asignados (`customers.assignedTo`) y solo las campañas
  que él creó.