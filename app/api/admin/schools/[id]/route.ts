import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogItemCrud } from '@/lib/cotizaciones/catalog'
import { quotationSchools } from '@/db/schema'

const crud = createCatalogItemCrud(CATALOG_DEFS.schools, quotationSchools)

export const { PUT, DELETE } = crud