import {
    LEAD_FIELD_LABELS,
    type LeadField
} from './google-sheets-fields'

export interface AppsScriptConfig {
    integrationName: string
    organizationId: string
    fields: LeadField[]
}

export interface AppsScriptProperty {
    key: string
    value: string
    description: string
}

function commentSafe(value: string): string {
    return value.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ')
}

function fileNameSafe(value: string): string {
    const slug = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50)
    return `${slug || 'google-sheets'}-apps-script.js`
}

export function appsScriptFilename(config: AppsScriptConfig): string {
    return fileNameSafe(config.integrationName)
}

export function appsScriptProperties(
    config: AppsScriptConfig
): AppsScriptProperty[] {
    return [
        {
            key: 'API_SECRET',
            value: '',
            description:
                'La misma clave secreta que guardás en esta integración. Generala acá y pegala en ambos lados.'
        },
        {
            key: 'ORGANIZATION_ID',
            value: config.organizationId,
            description:
                'Identificador de la organización. Debe coincidir exactamente con el del CRM.'
        },
        {
            key: 'SPREADSHEET_ID',
            value: '',
            description:
                'ID del documento de Google Sheets, entre /d/ y /edit en su URL.'
        }
    ]
}

export const APPS_SCRIPT_STEPS = [
    'Creá una hoja de cálculo nueva en Google Drive y una pestaña llamada Leads. Podés dejarla vacía.',
    'Abrí Extensiones → Apps Script y borrá el contenido del archivo Código.gs.',
    'Pegá el código generado y guardá el proyecto.',
    'Abrí Configuración del proyecto → Propiedades del script y creá las tres propiedades que aparecen abajo.',
    'Implementá como Aplicación web: Ejecutar como “Yo” y acceso “Cualquier persona”.',
    'Copiá la URL que termina en /exec y pegala en esta integración, junto con la misma API_SECRET.',
    'Presioná Probar conexión. Después activá y guardá la integración; la primera sincronización llena la hoja.',
    'Si cambiás los campos, volvé a copiar y publicar el código. El orden y los encabezados deben coincidir con la hoja.'
]

export function buildAppsScript(config: AppsScriptConfig): string {
    const fields = JSON.stringify(config.fields)
    const headers = JSON.stringify([
        ...config.fields.map((field) => LEAD_FIELD_LABELS[field]),
        '__id'
    ])
    const labels = config.fields
        .map((field) => LEAD_FIELD_LABELS[field])
        .join(', ')

    return `/** CRM -> Google Sheets, protocolo v2. Sin librerías externas.
 * Integración: ${commentSafe(config.integrationName)}
 * Campos: ${labels}
 * Propiedades del script: API_SECRET, ORGANIZATION_ID, SPREADSHEET_ID.
 * Desplegar como propietario, acceso Cualquiera. No poner secretos en el código.
 * La última columna contiene el ID interno y se oculta. La pestaña _CRM_SYNC
 * guarda versiones y borrados: no la borres mientras haya trabajos pendientes.
 */
var FIELDS = ${fields};
var HEADERS = ${headers};
var ID_COLUMN = HEADERS.length;
var COLUMN_COUNT = HEADERS.length;
var LAYOUT = FIELDS.join(',');
var DEFAULT_LAYOUT = 'name,phone,email,notes,status';

// Google Apps Script invoca esta función por nombre.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doPost(e) {
    var lock = LockService.getScriptLock();
    var body = {};
    var organizationId = '';
    try {
        body = JSON.parse(e && e.postData ? e.postData.contents : '{}');
        if (!body || typeof body !== 'object') throw new Error('INVALID_REQUEST');
        var properties = PropertiesService.getScriptProperties();
        var secret = properties.getProperty('API_SECRET');
        organizationId = properties.getProperty('ORGANIZATION_ID');
        var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
        if (!secret || !organizationId || !spreadsheetId) throw new Error('NOT_CONFIGURED');
        if (!safeEqual_(body.secret, secret)) throw new Error('UNAUTHORIZED');
        if (body.organizationId !== organizationId) throw new Error('ORGANIZATION_MISMATCH');
        if (body.protocol !== 2 || ['ping', 'upsert', 'delete'].indexOf(body.action) < 0) throw new Error('INVALID_REQUEST');
        if (!lock.tryLock(5000)) throw new Error('BUSY');
        // getActiveSpreadsheet() no es confiable en una ejecución de Web App.
        var book = SpreadsheetApp.openById(spreadsheetId);
        var sheet = book.getSheetByName('Leads') || book.insertSheet('Leads');
        var ledger = book.getSheetByName('_CRM_SYNC') || book.insertSheet('_CRM_SYNC');
        ensureLayout_(sheet, ledger, organizationId);
        var result;
        if (body.action === 'ping') {
            result = { sheet: 'Leads', rows: Math.max(0, sheet.getLastRow() - 1) };
        } else {
            var lead = body.lead || {};
            var id = lead.id;
            if (typeof id !== 'string' || id.length > 300 || id.indexOf(encodeURIComponent(organizationId) + ':') !== 0 ||
                !Number.isSafeInteger(body.version) || body.version < 1) throw new Error('INVALID_REQUEST');
            result = applyOperation_(sheet, ledger, body.action, lead, body.version);
            result.id = id;
            result.version = body.version;
        }
        result.ok = true;
        result.protocol = 2;
        result.action = body.action;
        result.organizationId = organizationId;
        SpreadsheetApp.flush();
        return json_(result);
    } catch (error) {
        var known = ['NOT_CONFIGURED', 'UNAUTHORIZED', 'ORGANIZATION_MISMATCH', 'INVALID_REQUEST', 'BUSY', 'MIGRATION_REQUIRED', 'LAYOUT_MISMATCH'];
        var code = error && known.indexOf(error.message) >= 0 ? error.message : 'WRITE_FAILED';
        return json_({ ok: false, protocol: 2, action: body.action, code: code });
    } finally {
        if (lock.hasLock()) lock.releaseLock();
    }
}

function json_(value) {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function safeEqual_(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    var diff = a.length ^ b.length;
    for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
}
function safeCell_(value) {
    if (value == null) return '';
    var text = String(value).replace(/\\u0000/g, '').replace(/\\r\\n?/g, '\\n');
    // Incluye espacios antes de prefijos de fórmula. Todas las celdas se escriben como texto.
    return /^[\\s]*[=+\\-@]/.test(text) ? "'" + text : text;
}
function ensureRows_(sheet, row) {
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
}
function columnLetter_(column) {
    var letter = '';
    while (column > 0) {
        var mod = (column - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        column = Math.floor((column - 1) / 26);
    }
    return letter;
}
function ensureLayout_(sheet, ledger, organizationId) {
    if (sheet.getMaxColumns() < COLUMN_COUNT) sheet.insertColumnsAfter(sheet.getMaxColumns(), COLUMN_COUNT - sheet.getMaxColumns());
    // Una pestaña Leads vacía (sin encabezados) es una hoja nueva: se puede
    // adoptar la selección de campos actual aunque el ledger ya exista.
    var freshSheet = sheet.getLastRow() === 0;
    if (freshSheet) {
        sheet.getRange(1, 1, 1, COLUMN_COUNT).setValues([HEADERS]).setFontWeight('bold');
        sheet.setFrozenRows(1);
    } else {
        var current = sheet.getRange(1, 1, 1, COLUMN_COUNT).getDisplayValues()[0];
        for (var i = 0; i < COLUMN_COUNT; i++) {
            if (String(current[i]) !== HEADERS[i]) throw new Error('LAYOUT_MISMATCH');
        }
    }
    if (ledger.getLastRow() === 0) {
        // Rechazar IDs antiguos ambiguos en vez de duplicar exportaciones.
        if (sheet.getLastRow() > 1) throw new Error('MIGRATION_REQUIRED');
        ledger.getRange(1, 1, 1, 5).setNumberFormat('@').setValues([['ID', 'Version', 'State', organizationId, LAYOUT]]);
    } else {
        if (ledger.getRange(1, 4).getDisplayValue() !== organizationId) throw new Error('ORGANIZATION_MISMATCH');
        var storedLayout = ledger.getRange(1, 5).getDisplayValue();
        if (storedLayout && storedLayout !== LAYOUT) {
            // Solo se acepta un diseño nuevo si la pestaña Leads se reemplazó
            // por una vacía; el ledger (versiones y borrados) se conserva.
            if (!freshSheet) throw new Error('LAYOUT_MISMATCH');
            ledger.getRange(1, 5).setNumberFormat('@').setValue(LAYOUT);
        }
        if (!storedLayout) {
            // Hojas v2 anteriores a la selección de campos usaban el diseño fijo.
            if (!freshSheet && LAYOUT !== DEFAULT_LAYOUT) throw new Error('LAYOUT_MISMATCH');
            ledger.getRange(1, 5).setNumberFormat('@').setValue(LAYOUT);
        }
    }
    sheet.hideColumns(ID_COLUMN);
    // Ocultar la antigua columna de versión v1 si la hoja venía inicializada.
    if (sheet.getMaxColumns() >= 7 && sheet.getRange(1, 7).getDisplayValue() === '__version') sheet.hideColumns(7);
    ledger.hideSheet();
    protect_(sheet, sheet.getRange(columnLetter_(ID_COLUMN) + ':' + columnLetter_(ID_COLUMN)), 'CRM IDs');
    protect_(ledger, ledger.getRange('A:E'), 'CRM versions');
}
function protect_(sheet, range, description) {
    try {
        var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
        if (protections.some(function (p) { return p.getDescription() === description; })) return;
        var protection = range.protect().setDescription(description);
        protection.addEditor(Session.getEffectiveUser());
        protection.removeEditors(protection.getEditors().filter(function (editor) {
            return editor.getEmail() !== Session.getEffectiveUser().getEmail();
        }));
        if (protection.canDomainEdit()) protection.setDomainEdit(false);
    } catch { /* Las reglas del propietario o Workspace pueden impedirlo. */ }
}
function findRows_(sheet, column, id) {
    if (sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, column, sheet.getLastRow() - 1, 1).createTextFinder(id)
        .matchEntireCell(true).useRegularExpression(false).findAll().map(function (cell) { return cell.getRow(); });
}
function applyOperation_(sheet, ledger, action, lead, version) {
    var id = lead.id;
    var ledgerRow = findRows_(ledger, 1, id)[0] || 0;
    if (ledgerRow) {
        var previous = ledger.getRange(ledgerRow, 2, 1, 2).getDisplayValues()[0];
        var storedVersion = Number(previous[0]);
        if (storedVersion > version) return { applied: false, reason: 'stale' };
        if (storedVersion === version && previous[1] === 'done') return { applied: false, reason: 'duplicate' };
    } else {
        ledgerRow = ledger.getLastRow() + 1;
        ensureRows_(ledger, ledgerRow);
    }
    // Guardar la versión antes de la escritura visible. Un reintento reanuda 'pending';
    // una solicitud vieja nunca puede adelantar a una operación nueva interrumpida.
    ledger.getRange(ledgerRow, 1, 1, 3).setNumberFormat('@').setValues([[id, String(version), 'pending']]);
    SpreadsheetApp.flush();
    var rows = findRows_(sheet, ID_COLUMN, id).sort(function (a, b) { return a - b; });
    if (action === 'delete') {
        rows.reverse().forEach(function (row) { sheet.deleteRow(row); });
    } else {
        var target = rows[0] || sheet.getLastRow() + 1;
        ensureRows_(sheet, target);
        var values = FIELDS.map(function (field) { return safeCell_(lead[field]); });
        values.push(id);
        sheet.getRange(target, 1, 1, COLUMN_COUNT).setNumberFormat('@').setValues([values]);
        // Reparar duplicados solo cuando su ID interno coincide exactamente.
        rows.slice(1).reverse().forEach(function (row) { sheet.deleteRow(row); });
    }
    SpreadsheetApp.flush();
    ledger.getRange(ledgerRow, 3).setValue('done');
    SpreadsheetApp.flush();
    return { applied: true };
}
`
}
