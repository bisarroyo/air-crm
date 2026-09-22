import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationExtras } from '@/db/schema'

const crud = createCatalogCrud(CATALOG_DEFS.extras, quotationExtras)

export const { GET, POST } = crud