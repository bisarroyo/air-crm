import { CURRENCIES } from './shared'

export type CatalogFieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'switch'
    | 'select'
    | 'date'
    | 'image'

export interface CatalogFieldOption {
    value: string
    label: string
}

export interface CatalogField {
    key: string
    label: string
    type: CatalogFieldType
    required?: boolean
    min?: number
    max?: number
    step?: number
    placeholder?: string
    helper?: string
    /** Static options for `select` fields. */
    options?: CatalogFieldOption[]
    /** Endpoint (without `/api` prefix) to fetch dynamic options, e.g. `admin/programs`. */
    optionsApi?: string
    optionLabelKey?: string
    /** Serialize the chosen value as a number instead of a string. */
    numeric?: boolean
    /** DB column JS name when the field key differs from the persisted column (e.g. `price` → `priceCents`). */
    dbKey?: string
    default?: string | number | boolean | null
    /** Show this field as a column in the admin list table. */
    showInTable?: boolean
    /** Display raw (already formatted) value in the table. */
    format?: 'number' | 'cents' | 'date' | 'text' | 'euros'
}

export interface CatalogConfig {
    /** API entity segment, e.g. `programs` (paths: /api/admin/programs). */
    entity: string
    title: string
    singular: string
    fields: CatalogField[]
}

export const PRICE_TYPE_OPTIONS: CatalogFieldOption[] = [
    { value: 'fixed', label: 'Precio fijo' },
    { value: 'variable', label: 'Precio variable' }
]

export const DISCOUNT_TYPE_OPTIONS: CatalogFieldOption[] = [
    { value: 'percent', label: 'Porcentaje (%)' },
    { value: 'fixed', label: 'Monto fijo (€)' }
]

export const CURRENCY_OPTIONS: CatalogFieldOption[] = CURRENCIES.map(
    (c) => ({ value: c, label: c })
)

export const CATALOG_DEFS: Record<string, CatalogConfig> = {
    programs: {
        entity: 'programs',
        title: 'Programas',
        singular: 'Programa',
        fields: [
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                showInTable: true
            },
            {
                key: 'description',
                label: 'Descripción',
                type: 'textarea',
                showInTable: false
            },
            {
                key: 'includes',
                label: 'Incluye (uno por línea)',
                type: 'textarea',
                helper: 'Lista de beneficios que aparecen en la cotización (Matrícula, Seguro médico, etc.)',
                showInTable: false
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    },
    schedules: {
        entity: 'schedules',
        title: 'Horarios',
        singular: 'Horario',
        fields: [
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                placeholder: 'Mañana',
                showInTable: true
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    },
    schools: {
        entity: 'schools',
        title: 'Escuelas',
        singular: 'Escuela',
        fields: [
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                showInTable: true
            },
            {
                key: 'description',
                label: 'Descripción',
                type: 'textarea'
            },
            {
                key: 'logo',
                label: 'Logo (URL o imagen)',
                type: 'image'
            },
            {
                key: 'website',
                label: 'Página web',
                type: 'text',
                placeholder: 'https://...'
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    },
    courses: {
        entity: 'courses',
        title: 'Cursos',
        singular: 'Curso',
        fields: [
            {
                key: 'programId',
                label: 'Programa',
                type: 'select',
                optionsApi: 'admin/programs',
                optionLabelKey: 'name',
                numeric: true,
                required: true
            },
            {
                key: 'schoolId',
                label: 'Escuela',
                type: 'select',
                optionsApi: 'admin/schools',
                optionLabelKey: 'name',
                numeric: true,
                required: true
            },
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                placeholder: 'Curso de inglés',
                showInTable: true
            },
            {
                key: 'description',
                label: 'Descripción',
                type: 'textarea'
            },
            {
                key: 'weeks',
                label: 'Cantidad de semanas',
                type: 'number',
                required: true,
                min: 0,
                step: 1,
                showInTable: true,
                format: 'number'
            },
            {
                key: 'scheduleId',
                label: 'Horario',
                type: 'select',
                optionsApi: 'admin/schedules',
                optionLabelKey: 'name',
                numeric: true
            },
            {
                key: 'hoursPerWeek',
                label: 'Horas por semana',
                type: 'number',
                required: true,
                min: 0,
                step: 1,
                showInTable: true,
                format: 'number'
            },
            {
                key: 'price',
                label: 'Precio total del curso (€)',
                type: 'number',
                required: true,
                min: 0,
                step: 0.01,
                placeholder: 'Ej. 3099 = €3.099',
                helper: 'Precio total del curso en euros.',
                showInTable: true,
                format: 'euros',
                dbKey: 'priceCents'
            },
            {
                key: 'currency',
                label: 'Moneda',
                type: 'select',
                options: CURRENCY_OPTIONS,
                default: 'EUR'
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    },
    accommodations: {
        entity: 'accommodations',
        title: 'Alojamientos',
        singular: 'Alojamiento',
        fields: [
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                placeholder: 'Residencia estudiantil',
                showInTable: true
            },
            {
                key: 'type',
                label: 'Tipo de alojamiento',
                type: 'text',
                required: true,
                placeholder: 'Residencia estudiantil'
            },
            {
                key: 'description',
                label: 'Descripción',
                type: 'textarea'
            },
            {
                key: 'pricePerWeek',
                label: 'Precio por semana (€)',
                type: 'number',
                required: true,
                min: 0,
                step: 0.01,
                placeholder: 'Ej. 350 = €350',
                showInTable: true,
                format: 'euros',
                dbKey: 'pricePerWeekCents'
            },
            {
                key: 'currency',
                label: 'Moneda',
                type: 'select',
                options: CURRENCY_OPTIONS,
                default: 'EUR'
            },
            {
                key: 'minWeeks',
                label: 'Mínimo de semanas',
                type: 'number',
                min: 0,
                step: 1
            },
            {
                key: 'maxWeeks',
                label: 'Máximo de semanas',
                type: 'number',
                min: 0,
                step: 1
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    },
    extras: {
        entity: 'extras',
        title: 'Extras',
        singular: 'Extra',
        fields: [
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                placeholder: 'Curso de Barista',
                showInTable: true
            },
            {
                key: 'description',
                label: 'Descripción',
                type: 'textarea'
            },
            {
                key: 'price',
                label: 'Precio (€, 0 = Gratis)',
                type: 'number',
                required: true,
                min: 0,
                step: 0.01,
                showInTable: true,
                format: 'euros',
                dbKey: 'priceCents'
            },
            {
                key: 'currency',
                label: 'Moneda',
                type: 'select',
                options: CURRENCY_OPTIONS,
                default: 'EUR'
            },
            {
                key: 'priceType',
                label: 'Tipo de precio',
                type: 'select',
                options: PRICE_TYPE_OPTIONS,
                default: 'fixed'
            },
            {
                key: 'application',
                label: 'Aplicación',
                type: 'text',
                placeholder: 'Ej. Matrícula, Inscripción'
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    },
    discounts: {
        entity: 'discounts',
        title: 'Descuentos',
        singular: 'Descuento',
        fields: [
            {
                key: 'name',
                label: 'Nombre',
                type: 'text',
                required: true,
                placeholder: '10% de descuento por inscripción',
                showInTable: true
            },
            {
                key: 'type',
                label: 'Tipo',
                type: 'select',
                options: DISCOUNT_TYPE_OPTIONS,
                default: 'percent',
                showInTable: true
            },
            {
                key: 'value',
                label: 'Valor',
                type: 'number',
                required: true,
                min: 0,
                step: 0.01,
                helper: 'Para porcentaje: 10 → 10%. Para monto fijo: euros (150 = €150).',
                showInTable: true,
                format: 'euros'
            },
            {
                key: 'currency',
                label: 'Moneda',
                type: 'select',
                options: CURRENCY_OPTIONS,
                default: 'EUR'
            },
            {
                key: 'startsAt',
                label: 'Fecha de inicio',
                type: 'date'
            },
            {
                key: 'endsAt',
                label: 'Fecha de vencimiento',
                type: 'date'
            },
            {
                key: 'isActive',
                label: 'Activo',
                type: 'switch',
                default: true
            }
        ]
    }
}

export function catalogConfig(entity: string): CatalogConfig | null {
    return CATALOG_DEFS[entity] ?? null
}