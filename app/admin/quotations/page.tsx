import Link from 'next/link'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'

const SECTIONS = [
    {
        href: '/admin/quotations/programs',
        title: 'Programas',
        description: 'Programas educativos con descripción y beneficios'
    },
    {
        href: '/admin/quotations/schools',
        title: 'Escuelas',
        description: 'Escuelas de idiomas y sus datos'
    },
    {
        href: '/admin/quotations/schedules',
        title: 'Horarios',
        description: 'Horarios disponibles por curso'
    },
    {
        href: '/admin/quotations/courses',
        title: 'Cursos',
        description: 'Cursos con semanas, horas y precios'
    },
    {
        href: '/admin/quotations/accommodations',
        title: 'Alojamientos',
        description: 'Tipos de alojamiento y precio semanal'
    },
    {
        href: '/admin/quotations/extras',
        title: 'Extras',
        description: 'Servicios adicionales opcionales'
    },
    {
        href: '/admin/quotations/discounts',
        title: 'Descuentos',
        description: 'Descuentos por porcentaje o monto fijo'
    },
    {
        href: '/admin/quotations/includes',
        title: 'Incluye de escuelas',
        description: 'Beneficios del paquete por escuela (certificaciones, fees, etc.)'
    },
    {
        href: '/admin/quotations/settings',
        title: 'S Travel Settings',
        description: 'Datos de empresa, logo y condiciones'
    }
] as const

export default function QuotationsAdminPage() {
    return (
        <div className='container mx-auto space-y-6 p-6'>
            <h1 className='text-2xl font-medium'>Cotizaciones</h1>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {SECTIONS.map((section) => (
                    <Link href={section.href} key={section.href}>
                        <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                            <CardHeader>
                                <CardTitle>{section.title}</CardTitle>
                                <CardDescription>
                                    {section.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className='text-sm text-muted-foreground'>
                                    Gestiona el catálogo usado al armar las
                                    cotizaciones.
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}