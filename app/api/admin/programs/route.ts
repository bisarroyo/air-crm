import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationPrograms } from '@/db/schema'

const crud = createCatalogCrud(CATALOG_DEFS.programs, quotationPrograms)

export const { GET, POST } = crud