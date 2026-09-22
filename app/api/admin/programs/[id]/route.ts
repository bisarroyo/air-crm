import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogItemCrud } from '@/lib/cotizaciones/catalog'
import { quotationPrograms } from '@/db/schema'

const crud = createCatalogItemCrud(CATALOG_DEFS.programs, quotationPrograms)

export const { PUT, DELETE } = crud