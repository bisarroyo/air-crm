'use client'
import { useState, useTransition } from 'react'

import { Edit, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { convertImageToBase64 } from '@/lib/utils'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import { toast } from 'sonner'
import { useSession } from '@/hooks/use-session'
import { authClient } from '@/lib/auth-client'

export default function EditUserDialog() {
    const { session: data } = useSession()
    const [name, setName] = useState<string>()
    const router = useRouter()
    const [image, setImage] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setImage(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }
    const [open, setOpen] = useState<boolean>(false)
    const [isLoading, startTransition] = useTransition()
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size='sm' className='gap-2' variant='secondary' />}>
                <Edit size={13} />
                Actualizar Información
            </DialogTrigger>
            <DialogContent className='sm:max-w-[425px] w-11/12'>
                <DialogHeader>
                    <DialogTitle>Editar información personal</DialogTitle>
                    <DialogDescription>
                        Actualiza tu información personal
                    </DialogDescription>
                </DialogHeader>
                <div className='grid gap-2'>
                    <Label htmlFor='name'>Nombre completo</Label>
                    <Input
                        id='name'
                        type='name'
                        placeholder={data?.user.name}
                        required
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setName(e.target.value)
                        }}
                    />
                    <div className='grid gap-2'>
                        <Label htmlFor='image'>Imagen de perfil</Label>
                        <div className='flex items-end gap-4'>
                            {imagePreview && (
                                <div className='relative w-16 h-16 rounded-sm overflow-hidden'>
                                    <Image
                                        src={imagePreview}
                                        alt='Profile preview'
                                        layout='fill'
                                        objectFit='cover'
                                    />
                                </div>
                            )}
                            <div className='flex items-center gap-2 w-full'>
                                <Input
                                    id='image'
                                    type='file'
                                    accept='image/*'
                                    onChange={handleImageChange}
                                    className='w-full text-muted-foreground'
                                />
                                {imagePreview && (
                                    <X
                                        className='cursor-pointer'
                                        onClick={() => {
                                            setImage(null)
                                            setImagePreview(null)
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        disabled={isLoading}
                        onClick={async () => {
                            startTransition(async () => {
                                await authClient.updateUser({
                                    image: image
                                        ? await convertImageToBase64(image)
                                        : undefined,
                                    name: name ? name : undefined,
                                    fetchOptions: {
                                        onSuccess: () => {
                                            toast.success(
                                                'User updated successfully'
                                            )
                                        },
                                        onError: (error: {
                                            error: { message: string }
                                        }) => {
                                            toast.error(error.error.message)
                                        }
                                    }
                                })
                                startTransition(() => {
                                    setName('')
                                    router.refresh()
                                    setImage(null)
                                    setImagePreview(null)
                                    setOpen(false)
                                })
                            })
                        }}>
                        {isLoading ? (
                            <Loader2 size={15} className='animate-spin' />
                        ) : (
                            'Actualizar'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
