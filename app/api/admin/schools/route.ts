import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationSchools } from '@/db/schema'

const crud = createCatalogCrud(CATALOG_DEFS.schools, quotationSchools)

export const { GET, POST } = crud