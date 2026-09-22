import { CATALOG_DEFS } from '@/lib/cotizaciones/catalog-def'
import { createCatalogCrud } from '@/lib/cotizaciones/catalog'
import { quotationCourses } from '@/db/schema'

const crud = createCatalogCrud(CATALOG_DEFS.courses, quotationCourses)

export const { GET, POST } = crud