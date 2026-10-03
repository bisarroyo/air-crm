/**
 * Límites compartidos entre el servidor y el navegador.
 *
 * Este archivo NO importa nada del servidor a propósito: los componentes cliente
 * necesitan leer el mismo límite, e importar `lib/email/recipients` arrastraría
 * `@/db` al bundle del navegador (y el cliente de libsql se crea al evaluar el
 * módulo, así que falla en el navegador con `URL_INVALID: 'undefined'`).
 */
export const CAMPAIGN_MAX_RECIPIENTS = 500