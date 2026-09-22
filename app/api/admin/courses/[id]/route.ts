import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogItemCrud } from '@/lib/cotizaciones/catalog'
import { quotationCourses } from '@/db/schema'

const crud = createCatalogItemCrud(CATALOG_DEFS.courses, quotationCourses)

export const { PUT, DELETE } = crud