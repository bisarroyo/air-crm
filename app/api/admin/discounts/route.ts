import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationDiscounts } from '@/db/schema'

const crud = createCatalogCrud(CATALOG_DEFS.discounts, quotationDiscounts)

export const { GET, POST } = crud