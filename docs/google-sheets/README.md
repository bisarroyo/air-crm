# CRM → Google Sheets (protocolo v2)

Turso es la fuente principal. La integración envía únicamente nombre, teléfono,
correo, notas y nombre legible del estado. No importa cambios manuales de Sheets.

## Cambios de esta revisión

- `customers.organization_id` y `travel_leads.organization_id` identifican al
  propietario. Los registros anteriores conservan `NULL`: **no se asignan por
  conjetura ni se exportan**. Las altas autenticadas requieren organización
  activa y membresía; el formulario público usa una organización configurada
  exclusivamente en el servidor.
- Configuración, prueba, sincronización y reintentos requieren rol `owner` o
  `admin` **de esa organización**, comprobado en Turso. El rol global `admin`
  no sustituye la membresía. No existe fallback a `default`.
- Triggers SQLite insertan trabajos en la **misma transacción** que cada cambio
  relevante: creación, edición, importación, borrado, notas y renombre de estados.
  Los cambios de país, prioridad, etiquetas y otros campos no visibles no encolan.
  Una caída de Google nunca afecta esta transacción. Si Turso no puede persistir
  el cambio y su trabajo juntos, ambos se revierten.
- El autoincremento persistente del trabajo es su versión global. Los trabajos
  completados se conservan como historial y los anteriores pendientes se marcan
  como superados. No se depende del reloj ni de contadores de una instancia.
- Un UPDATE atómico reclama un trabajo con token de lease. Recuperación tras
  120 segundos; una ejecución anterior no puede modificar el resultado de un
  lease nuevo. Se procesa un trabajo a la vez, dentro del presupuesto restante.
- La sincronización inicial persiste cursores y prepara páginas de 100 leads
  por tipo. La solicitud responde antes de recorrer todos los leads. Cron y el
  sondeo administrativo reanudan el trabajo.
- Apps Script guarda versiones y borrados sin el antiguo límite de 500, en
  `_CRM_SYNC`, una pestaña oculta. Versiones iguales ya aplicadas no vuelven a
  escribir; los cambios interrumpidos se pueden reanudar.
- `/api/gs-selftest` está retirado: responde 404 y no accede a Turso.
- Una organización puede tener **varias integraciones**, cada una con su propio
  nombre, URL de Apps Script y hoja de cálculo. Los trabajos quedan ligados a una
  integración (`integration_id`); no se comparten entre destinos.
- Cada integración elige qué fuentes exporta (`sync_customers` / `sync_travel`) y
  qué estados de contactos y de viajes incluye. Una selección vacía significa
  **todos los estados**. Los estados se filtran al procesar cada lead, no solo al
  encolar: si un lead deja de coincidir, se envía `delete` para retirar su fila.
- Cada integración elige además qué **campos** exporta (`fields`): nombre, teléfono,
  correo, notas y estado. `NULL` o vacío significa todos, por compatibilidad con
  las integraciones existentes. El orden canónico es siempre ese; los campos solo
  controlan las columnas y encabezados del código generado. El worker sigue
  enviando los cinco datos para no romper scripts ya publicados.
- La lista muestra el nombre de cada integración y abre una página dedicada con
  configuración, selección de campos y el código exacto de Apps Script, sus
  propiedades y los pasos de publicación. El código generado no contiene secretos:
  lee `API_SECRET`, `ORGANIZATION_ID` y `SPREADSHEET_ID` de las propiedades del
  script.
- Cambiar la URL, activar una integración, alternar una fuente o modificar sus
  filtros reinicia los cursores correspondientes para hacer una reconciliación
  completa. Desactivar una fuente que estaba activa también reconcilia sus filas
  previamente exportadas. Cambiar solo los campos **no** reinicia cursores: hay que
  volver a publicar el script y ejecutar una sincronización manual. Si la pestaña
  `Leads` se reemplaza por una vacía, el script adopta el diseño nuevo y conserva
  `_CRM_SYNC`; si tiene datos con otros encabezados, responde `LAYOUT_MISMATCH`.

## Preparación y migraciones

1. Revisar el destino de `DATABASE_URL` antes de ejecutar migraciones.
2. Aplicar las migraciones pendientes mediante `pnpm db:migrate`. La integración
   original usa `0018_graceful_reavers.sql`; la fiabilidad de v2 añade
   `0019_google_sheets_reliability.sql`, las integraciones múltiples añaden
   `0020_noisy_dragon_man.sql` y la selección de campos añade
   `0021_flashy_the_call.sql`. `0017_fluffy_shen.sql` crea Travel, si todavía no
   se había aplicado. El journal conserva el orden.
3. La migración 0019 agrega columnas, índices y triggers; no borra contactos.
   Los trabajos anteriores quedan conservados como `protocol=1`, `dead`, porque
   su propiedad no era verificable. No se procesan ni se reintentan desde v2.
4. La migración 0020 elimina el índice único por organización, agrega nombre,
   fuentes, filtros de estado e `integration_id`, y recrea los triggers para que
   creen un trabajo por cada integración que sincroniza la fuente del lead. Los
   trabajos v2 sin integración quedan `dead`; hay que ejecutar una sincronización
   inicial desde la pantalla de integraciones.
4. Confirmar qué organización posee cada contacto anterior. Un operador debe
   aplicar un mapeo explícito de IDs con una sentencia parametrizada equivalente
   a `UPDATE customers SET organization_id = ? WHERE id IN (...) AND
   organization_id IS NULL`, y lo mismo para `travel_leads`. Verificar previamente
   la organización y sus miembros. La organización de un lead ya asignado es
   inmutable; no se permite trasladarlo por una edición normal.
   En un despliegue de una sola empresa se puede crear la organización inicial,
   agregar a los usuarios como miembros y asignar todos los leads anteriores con
   `pnpm org:bootstrap -- --name "S Travel Costa Rica" --slug
   "s-travel-costa-rica" --claim-legacy`. El comando es idempotente; sin
   `--claim-legacy` no toca los leads sin propietario.
5. Los leads sin asignar no aparecen en las listas principales por organización
   ni se exportan. No se deduce su organización a partir de `assignedTo`: una
   persona puede pertenecer a varias organizaciones.

Los estados y otros catálogos compartidos conservan el modelo existente. Un
renombre de estado global genera trabajos para los propietarios reales de cada
lead afectado. Esta tarea no convierte todos los módulos históricos de informes,
campañas y cotizaciones en una aplicación multiempresa; requieren su propia
revisión de alcance si se van a ofrecer a organizaciones independientes.

## Variables de entorno del servidor

```dotenv
# 32 bytes exactos en hex o base64. Generar: openssl rand -base64 32
GOOGLE_SHEETS_ENCRYPTION_KEY=...
# Generar: openssl rand -hex 32
CRON_SECRET=...
# ID real de Better Auth al que pertenece el formulario público /api/leads.
PUBLIC_LEADS_ORGANIZATION_ID=...
```

Conservar `DATABASE_URL`, `DATABASE_AUTH_TOKEN` y las variables de Better Auth
existentes. No usar prefijos `NEXT_PUBLIC_` para estos secretos. La clave compartida
con Google se cifra con AES-256-GCM. Si se cambia la clave de cifrado, volver a
introducir la clave compartida en cada configuración afectada. La API solo
expone `hasSecret`, nunca el secreto ni el texto cifrado.

Sin `PUBLIC_LEADS_ORGANIZATION_ID`, el formulario público responde 503; nunca
exporta el mismo lead a todas las organizaciones. El parámetro `organizationId`
de un formulario público no se utiliza como autoridad.

## Configurar Google Sheets

Cada integración tiene su propia hoja, URL y clave. El CRM genera el código de
Apps Script con la organización y las columnas ya elegidas; no hay que editar
constantes ni copiar el script de referencia a mano.

1. Iniciar sesión en el CRM con una organización activa y rol `owner` o `admin`.
2. Abrir **Integraciones → Google Sheets**,
   `/admin/integrations/google-sheets`, y presionar **Nueva integración**.
3. Asignar un **Nombre** que identifique la hoja (por ejemplo, “Contactos –
   Comercial” o “Viajes – Operaciones”). El nombre aparece en la lista, en el
   título de la página y en el archivo descargable del script.
4. Elegir las fuentes: **Sincronizar contactos**, **Sincronizar leads de viaje**
   o ambas. Debe quedar al menos una activa.
5. Para cada fuente activa, marcar los estados que se exportan. Sin marcas se
   exportan todos. Los estados se muestran como etiquetas, no como IDs.
6. En **Campos a sincronizar**, marcar las columnas deseadas. Debe quedar al
   menos una. El orden de columnas es fijo: Nombre, Teléfono, Correo, Notas,
   Estado, seguidas de `__id`, que se oculta. Se puede dejar el valor por defecto
   (todos los campos).
7. Presionar **Crear integración**. La URL y la clave pueden completarse después;
   la integración queda inactiva hasta configurarlas.
8. Abrir la pestaña **Instalar en Google Sheets**. El código ya incluye el nombre
   de la integración y las columnas elegidas, y no contiene secretos. Usar el
   botón de copiar o **Descargar**.
9. Crear una hoja de cálculo nueva en Google Drive y una pestaña llamada
   `Leads`. Puede quedar vacía: el script crea los encabezados y `__id`.
10. Abrir **Extensiones → Apps Script**, borrar el contenido de `Código.gs` y
    pegar el código generado. Guardar el proyecto.
11. Abrir **Configuración del proyecto → Propiedades del script → Agregar
    propiedad** y crear exactamente:
    - `API_SECRET`: una clave aleatoria compartida con el CRM. La misma que se
      pegará en **Clave secreta** de la integración.
    - `ORGANIZATION_ID`: ID exacto de la organización de Better Auth; el código
      generado y la pantalla de la integración lo muestran.
    - `SPREADSHEET_ID`: ID del documento entre `/d/` y `/edit` en su URL.
    Los nombres distinguen mayúsculas y no llevan espacios.
12. **Implementar → Nueva implementación → Aplicación web**.
13. Seleccionar **Ejecutar como: Yo**, propietario de la hoja.
14. Seleccionar **Quién tiene acceso: Cualquier persona**. El cliente del CRM no
    envía cookies de Google ni OAuth; restringir al dominio no funciona con este
    transporte. Si Workspace prohíbe acceso anónimo, usar la alternativa OAuth.
15. Autorizar los permisos solicitados por Google y copiar la URL que termina en
    `/exec` (no `/dev`).
16. Volver a la integración, pestaña **Configuración**: pegar la URL `/exec` y la
    misma clave que `API_SECRET`. Activar **Sincronización activa** y guardar.
17. Presionar **Probar conexión**. La prueba valida secreto, organización, versión
    del protocolo, diseño de columnas y disponibilidad de `Leads`; no crea ni
    modifica leads.
18. Ejecutar **Sincronizar todo**. Se prepara una reconciliación completa por
    lotes; el botón de la lista o de la página dedicada repite el proceso cuando
    haga falta.
19. Consultar pendientes, procesando, fallidas y último éxito por integración. La
    pantalla muestra preparación por lotes sin inventar porcentajes de progreso.
20. Crear un lead y comprobar las columnas visibles; el teléfono conserva ceros y
    formato textual.
21. Cambiar su estado y comprobar que actualiza la misma fila y muestra la etiqueta
    del estado, no su ID. Agregar, editar y eliminar notas y comprobar su columna.
22. Cambiar los estados seleccionados o desactivar una fuente y ejecutar
    **Sincronizar todo**: las filas que ya no coincidan deben desaparecer de esa
    hoja sin afectar a las demás integraciones.

Repetir el flujo por cada hoja que se quiera mantener. Se puede usar el mismo
`ORGANIZATION_ID` en todas las implementaciones, pero cada integración necesita
su propio `SPREADSHEET_ID`, su propia URL `/exec` y una `API_SECRET` propia.

`docs/google-sheets/apps-script.js` se conserva como referencia del script con
todos los campos. La fuente de verdad para una integración concreta es el código
generado en su página.

### Cambiar los campos sincronizados

1. En **Campos a sincronizar**, modificar la selección y guardar.
2. Volver a **Instalar en Google Sheets**, copiar el código actualizado y
   publicar una **Nueva versión** de la implementación. La URL `/exec` se
   mantiene.
3. Si el número u orden de columnas cambió y la pestaña `Leads` ya tiene datos,
   **archivar o eliminar `Leads` y crear una pestaña `Leads` vacía**. No hace falta
   borrar `_CRM_SYNC`: al detectar la hoja vacía, el script adopta el diseño nuevo
   y conserva el historial de versiones y borrados. Si se deja la hoja con datos y
   encabezados distintos, el script responde `LAYOUT_MISMATCH`.
4. Ejecutar **Sincronizar todo** para llenar la hoja nueva. Cambiar los campos no
   reinicia los cursores; la reconciliación manual es la que vuelve a exportar
   todos los leads que coinciden.

No cambiar el orden de `FIELDS` ni los encabezados a mano en el script: el CRM
valida el archivo generado contra la hoja. Las filas antiguas no se migran
automáticamente a un diseño nuevo.

Las notas se ordenan de más reciente a más antigua, con fecha de Costa Rica,
separadas por saltos de línea. No se añade un prefijo de país inventado: se envía
el teléfono registrado. Los borrados de contactos/Travel son físicos y se reflejan
eliminando solo filas cuyo ID F coincide. El filtro de estados también retira
filas cuando un lead cambia a un estado excluido.

## Actualizar una implementación anterior

Publicar v2 antes de habilitar el worker actualizado. No mezclar ambos protocolos.

Si la hoja contiene IDs antiguos como `customer:123`, **archivar la pestaña anterior
con otro nombre y crear una pestaña `Leads` vacía**, sin borrar la copia. Luego
asignar los leads a su organización y ejecutar sincronización completa. El script
rechaza hojas con datos sin su registro de versiones para no duplicar ni adoptar
filas cuyo propietario se desconoce.

Para publicar cambios: guardar el código generado, **Implementar → Administrar
implementaciones → Editar → Versión: Nueva versión → Implementar**. La URL se
mantiene. Si se crea otra implementación, actualizar la URL en el CRM y probarla.
Cambiar la URL o reactivar una integración inicia una nueva exploración completa.
Las filas de una hoja antigua no se eliminan automáticamente al cambiar destino.

Cada integración tiene su propia implementación y `SPREADSHEET_ID`. Para agregar
otra hoja, crear una integración nueva y seguir el código generado en su pestaña
**Instalar en Google Sheets**; no hace falta duplicar manualmente el script. Cada
implementación usa la misma `ORGANIZATION_ID` y una `API_SECRET` propia. No se
comparte la pestaña `_CRM_SYNC` entre documentos ni se copia a otro destino:
pertenece a un único documento y organización. Si se cambia solo
`SPREADSHEET_ID` conservando la URL, ejecutar manualmente la sincronización
completa de esa integración. Cambiar la URL, reactivar la integración, alternar
fuentes o cambiar filtros inicia una nueva exploración completa y retira de esa
hoja las filas que ya no coincidan. Las filas de una hoja antigua no se eliminan
automáticamente al cambiar el destino de la integración; para limpiarlas, usar el
mismo documento o eliminarlas manualmente. Los IDs incluyen organización, tipo de
lead e ID, para evitar colisiones.

## Reintentos, ejecución y límites

- Los cambios despiertan `after()` tras responder. Los triggers ya dejaron la
  operación persistida antes de esa llamada; perder `after()` no pierde el trabajo.
- Backoff: 1, 2, 4… minutos, máximo 6 horas. Intentos configurables de 1 a 50,
  por defecto 8. Tras agotarse, usar **Reintentar fallidas**.
- Desactivar detiene el envío pero conserva cambios y borrados pendientes.
- El timeout total de una operación HTTP es como máximo 15 segundos, incluidas
  redirecciones y lectura del cuerpo, y se acorta al presupuesto disponible.
- Cron está configurado a `0 3 * * *` (UTC). El endpoint requiere exclusivamente
  `Authorization: Bearer <CRON_SECRET>`; no admite secretos en la URL.
- Sin actividad ni sondeo, el cron diario puede tardar uno o más días en vaciar
  una cola grande. Para reintentos rápidos y volumen sostenido, configurar un
  programador externo cada 1–5 minutos con ese header, o aumentar la frecuencia
  de Vercel Cron si el plan lo permite. No se promete procesamiento inmediato.
- Cada llamada a Apps Script procesa un lead bajo `LockService`, con espera de
  5 segundos. La búsqueda crece con el tamaño de la hoja y del historial; vigilar
  cuotas, duración, tamaño de celdas y crecimiento de ambas tablas/pestañas.
- No purgar versiones o registros de borrado mientras puedan existir solicitudes
  antiguas. El mantenimiento del historial necesita un procedimiento coordinado,
  no un recorte automático por cantidad de leads.

## Seguridad

Las URLs iniciales se restringen a implementaciones HTTPS de `script.google.com`;
solo se siguen redirecciones de respuesta a `script.googleusercontent.com`, usando
GET sin reenviar el secreto. HTTP 200 no basta: se valida protocolo, acción,
organización, ID, versión y resultado aplicado/idempotente. Los mensajes arbitrarios
que devuelve el endpoint no se almacenan ni se reflejan; se usan códigos conocidos.

El Web App es públicamente invocable. El secreto compartido proporciona protección
limitada y no equivale a OAuth ni impide abusos de cuota. Para datos sensibles o
requisitos más estrictos, usar Google Sheets API con una cuenta de servicio y
permisos limitados sobre la hoja.

La columna `__id` y `_CRM_SYNC` están ocultas y se intenta proteger sus rangos.
**Ocultar no es una medida de seguridad**: propietarios y editores con permisos
suficientes pueden mostrar o alterar información. No conceder edición a personas
no autorizadas. Las celdas se escriben como texto y se neutralizan prefijos de
fórmulas.

## Pruebas

```sh
pnpm test:google-sheets
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

La suite usa libSQL local aislado y las migraciones reales; prueba rollback,
propiedad, permisos, campos relevantes, notas, estados, cifrado, borrado, cursores,
concurrencia, reintentos, HTTP, versiones, integraciones múltiples, filtros por
fuente/estado, reconciliación al cambiar filtros, selección de campos, generación
del código de Apps Script y adopción de un diseño nuevo cuando la pestaña `Leads`
está vacía. Los dobles de Google no sustituyen una prueba real de
despliegue/autorizaciones/cuotas.

Prueba integral en una hoja de pruebas:

1. Crear dos organizaciones, cada una con su propio destino y administrador.
   Dentro de una organización, crear dos integraciones con hojas distintas.
2. Crear leads con nombres iguales, otro sin correo/teléfono (Travel lo permite)
   y otro sin notas. Solo deben aparecer en la hoja de su propietario y en la
   integración que sincroniza esa fuente.
3. Configurar una integración solo para contactos y otra solo para viajes;
   confirmar que cada hoja recibe únicamente su tipo de lead. Elegir un estado
   concreto y verificar que los demás no se exportan.
4. Cambiar un lead a un estado excluido o quitar ese estado del filtro y
   sincronizar: la fila debe desaparecer solo de esa integración.
3. Cambiar nombre, teléfono, correo y estado. Verificar la misma fila F, nombre
   legible de estado y ceros iniciales del teléfono.
4. Crear, editar y borrar notas de cliente. Confirmar fechas y orden descendente.
5. Renombrar un estado compartido: verificar todos los leads afectados en sus
   respectivas hojas, sin copiar leads entre organizaciones.
6. Ejecutar sincronización completa dos veces; no deben aparecer duplicados.
7. Borrar un lead; su fila desaparece. Desactivar, borrar otro y reactivar: también
   debe desaparecer. No se borran filas de otros IDs.
8. Usar una clave errónea: el CRM debe guardar leads normalmente y mostrar fallos
   de sincronización. Corregirla y reintentar; verificar recuperación.
9. Cerrar la pantalla durante una sincronización grande y comprobar que Cron la
   reanuda desde el cursor persistido.
10. Intentar acceder/editar leads y configuración con un miembro de otra
    organización, sin membresía y sin organización activa: deben rechazarse.
11. Enviar texto que comience con `=`, `+`, `-`, `@` o espacios seguidos de una
    fórmula. Debe permanecer como texto. Verificar que solo las columnas elegidas
    sean visibles, con `__id` y `_CRM_SYNC` ocultas.
12. En el entorno de pruebas, repetir peticiones y enviarlas fuera de orden:
    versiones menores no cambian ni eliminan datos más recientes.

## Referencias oficiales

- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [TextFinder](https://developers.google.com/apps-script/reference/spreadsheet/text-finder)
- [Límites de Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing)
