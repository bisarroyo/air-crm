export const COUNTRY_OPTIONS = [
    'México',
    'Guatemala',
    'El Salvador',
    'Honduras',
    'Nicaragua',
    'Costa Rica',
    'Panamá',
    'Cuba',
    'República Dominicana',
    'Puerto Rico',
    'Colombia',
    'Venezuela',
    'Ecuador',
    'Perú',
    'Bolivia',
    'Paraguay',
    'Chile',
    'Argentina',
    'Uruguay',
    'Brasil'
] as const

export type CountryOption = (typeof COUNTRY_OPTIONS)[number]