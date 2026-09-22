import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogItemCrud } from '@/lib/cotizaciones/catalog'
import { quotationSchedules } from '@/db/schema'

const crud = createCatalogItemCrud(CATALOG_DEFS.schedules, quotationSchedules)

export const { PUT, DELETE } = crud