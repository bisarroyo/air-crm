import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationAccommodations } from '@/db/schema'

const crud = createCatalogCrud(
    CATALOG_DEFS.accommodations,
    quotationAccommodations
)

export const { GET, POST } = crud