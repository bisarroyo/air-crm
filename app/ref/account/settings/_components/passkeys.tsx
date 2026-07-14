import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { authClient } from '@/lib/auth-client'
import { Passkey } from '@better-auth/passkey'
import { Fingerprint, Loader2, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function PasskeysComponent() {
    return (
        <div className='flex flex-col gap-2'>
            <p className='text-sm'>Llaves de acceso</p>
            <div className='flex gap-2 flex-wrap'>
                <AddPasskey />
                <ListPasskeys />
            </div>
        </div>
    )
}

function AddPasskey() {
    const [isOpen, setIsOpen] = useState(false)
    const [passkeyName, setPasskeyName] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleAddPasskey = async () => {
        if (!passkeyName) {
            toast.error('Nombre de la llave de acceso es obligatorio')
            return
        }
        setIsLoading(true)
        const res = await authClient.passkey.addPasskey({
            name: passkeyName
        })
        if (res?.error) {
            toast.error(res?.error.message)
        } else {
            setIsOpen(false)
            toast.success(
                'Llave de acceso agregada con éxito. Ahora puedes usarla para iniciar sesión.'
            )
        }
        setIsLoading(false)
    }
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button variant='outline' className='gap-2 text-xs md:text-sm' />}>
                <Plus size={15} />
                Agregar Llave de Acceso
            </DialogTrigger>
            <DialogContent className='sm:max-w-[425px] w-11/12'>
                <DialogHeader>
                    <DialogTitle>Agregar nueva llave de acceso</DialogTitle>
                    <DialogDescription>
                        Crea una nueva llave de acceso para tu cuenta para
                        iniciar sesión de forma segura, sin contraseña.
                    </DialogDescription>
                </DialogHeader>
                <div className='grid gap-2'>
                    <Label htmlFor='passkey-name'>
                        Nombre de la llave de acceso
                    </Label>
                    <Input
                        id='passkey-name'
                        value={passkeyName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPasskeyName(e.target.value)
                        }
                    />
                </div>
                <DialogFooter>
                    <Button
                        disabled={isLoading}
                        type='submit'
                        onClick={handleAddPasskey}
                        className='w-full'>
                        {isLoading ? (
                            <Loader2 size={15} className='animate-spin' />
                        ) : (
                            <>
                                <Fingerprint className='mr-2 h-4 w-4' />
                                Crear Llave de Acceso
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ListPasskeys() {
    const { data } = authClient.useListPasskeys()
    const [isOpen, setIsOpen] = useState(false)
    const [passkeyName, setPasskeyName] = useState('')

    const handleAddPasskey = async () => {
        if (!passkeyName) {
            toast.error('Nombre de la llave de acceso es obligatorio')
            return
        }
        setIsLoading(true)
        const res = await authClient.passkey.addPasskey({
            name: passkeyName
        })
        setIsLoading(false)
        if (res?.error) {
            toast.error(res?.error.message)
        } else {
            toast.success(
                'Llave de acceso agregada con éxito. Ahora puedes usarla para iniciar sesión.'
            )
        }
    }
    const [isLoading, setIsLoading] = useState(false)
    const [isDeletePasskey, setIsDeletePasskey] = useState<boolean>(false)
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button variant='outline' className='text-xs md:text-sm' />}>
                <Fingerprint className='mr-2 h-4 w-4' />
                <span>
                    Llaves de acceso{' '}
                    {data?.length ? `[${data?.length}]` : ''}
                </span>
            </DialogTrigger>
            <DialogContent className='sm:max-w-[425px] w-11/12'>
                <DialogHeader>
                    <DialogTitle>Llaves de acceso</DialogTitle>
                    <DialogDescription>
                        Lista de llaves de acceso
                    </DialogDescription>
                </DialogHeader>
                {data?.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((passkey: Passkey) => (
                                <TableRow
                                    key={passkey.id}
                                    className='flex  justify-between items-center'>
                                    <TableCell>
                                        {passkey.name || 'My Passkey'}
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        <button
                                            onClick={async () => {
                                                const res =
                                                    await authClient.passkey.deletePasskey(
                                                        {
                                                            id: passkey.id,
                                                            fetchOptions: {
                                                                onRequest:
                                                                    () => {
                                                                        setIsDeletePasskey(
                                                                            true
                                                                        )
                                                                    },
                                                                onSuccess:
                                                                    () => {
                                                                        toast(
                                                                            'Passkey deleted successfully'
                                                                        )
                                                                        setIsDeletePasskey(
                                                                            false
                                                                        )
                                                                    },
                                                                onError:
                                                                    (error: {
                                                                        error: {
                                                                            message: string
                                                                        }
                                                                    }) => {
                                                                        toast.error(
                                                                            error
                                                                                .error
                                                                                .message
                                                                        )
                                                                        setIsDeletePasskey(
                                                                            false
                                                                        )
                                                                    }
                                                            }
                                                        }
                                                    )
                                            }}>
                                            {isDeletePasskey ? (
                                                <Loader2
                                                    size={15}
                                                    className='animate-spin'
                                                />
                                            ) : (
                                                <Trash
                                                    size={15}
                                                    className='cursor-pointer text-red-600'
                                                />
                                            )}
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className='text-sm text-muted-foreground'>
                        No tienes llaves de acceso agregadas.
                    </p>
                )}
                {!data?.length && (
                    <div className='flex flex-col gap-2'>
                        <div className='flex flex-col gap-2'>
                            <Label htmlFor='passkey-name' className='text-sm'>
                                Nueva llave de acceso
                            </Label>
                            <Input
                                id='passkey-name'
                                value={passkeyName}
                                onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                ) => setPasskeyName(e.target.value)}
                                placeholder='My Passkey'
                            />
                        </div>
                        <Button
                            type='submit'
                            onClick={handleAddPasskey}
                            className='w-full'>
                            {isLoading ? (
                                <Loader2 size={15} className='animate-spin' />
                            ) : (
                                <>
                                    <Fingerprint className='mr-2 h-4 w-4' />
                                    Crear Llave de Acceso
                                </>
                            )}
                        </Button>
                    </div>
                )}
                <DialogFooter>
                    <Button onClick={() => setIsOpen(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
