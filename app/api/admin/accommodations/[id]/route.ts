import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogItemCrud } from '@/lib/cotizaciones/catalog'
import { quotationAccommodations } from '@/db/schema'

const crud = createCatalogItemCrud(
    CATALOG_DEFS.accommodations,
    quotationAccommodations
)

export const { PUT, DELETE } = crud