import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogItemCrud } from '@/lib/cotizaciones/catalog'
import { quotationDiscounts } from '@/db/schema'

const crud = createCatalogItemCrud(CATALOG_DEFS.discounts, quotationDiscounts)

export const { PUT, DELETE } = crud