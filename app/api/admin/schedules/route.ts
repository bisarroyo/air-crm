import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationSchedules } from '@/db/schema'

const crud = createCatalogCrud(CATALOG_DEFS.schedules, quotationSchedules)

export const { GET, POST } = crud