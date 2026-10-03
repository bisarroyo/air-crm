import Link from 'next/link'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'

export default function AdminPage() {
    return (
        <div className='container mx-auto space-y-6 p-6'>
            <h1 className='text-2xl font-medium'>Panel de administración</h1>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                <Link href='/admin/users'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Usuarios</CardTitle>
                            <CardDescription>
                                Administrar cuentas de usuarios
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Creá, editá, bloqueá, eliminá y gestioná
                                cuentas de usuarios.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/status'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Estados</CardTitle>
                            <CardDescription>
                                Administrar estados de clientes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Creá, editá, activá o desactivá opciones de
                                estado.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/priority'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Prioridades</CardTitle>
                            <CardDescription>
                                Administrar prioridades de clientes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Creá, editá, activá o desactivá niveles de
                                prioridad.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/referrals'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Referidos</CardTitle>
                            <CardDescription>
                                Administrar códigos de referido
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Creá, editá o eliminá códigos de referido y
                                asignalos a usuarios.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/tags'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Etiquetas</CardTitle>
                            <CardDescription>
                                Administrar etiquetas de leads
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Creá, editá, activá o desactivá etiquetas para
                                clasificar tus leads.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/quotations'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Cotizaciones</CardTitle>
                            <CardDescription>
                                Catálogo y configuración de cotizaciones
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Programas, escuelas, cursos, alojamientos,
                                extras, descuentos y ajustes de S Travel.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
