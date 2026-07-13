import { Button } from '@/components/ui/button'
import CopyButton from '@/components/ui/copy-button'
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
import { PasswordInput } from '@/components/ui/password-input'
import { authClient } from '@/lib/auth-client'
import { Session } from '@/lib/auth-types'
import { Loader2, QrCode, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'

export default function TwoFactor({ session }: { session: Session | null }) {
    const [isPendingTwoFa, setIsPendingTwoFa] = useState<boolean>(false)
    const [twoFaPassword, setTwoFaPassword] = useState<string>('')
    const [twoFactorDialog, setTwoFactorDialog] = useState<boolean>(false)
    const [twoFactorVerifyURI, setTwoFactorVerifyURI] = useState<string>('')
    return (
        <div className='flex flex-col gap-2'>
            <p className='text-sm'>Autenticación de 2 factores</p>
            <div className='flex gap-2'>
                {!!session?.user.twoFactorEnabled && (
                    <Dialog>
                        <DialogTrigger render={<Button variant='outline' className='gap-2' />}>
                            <QrCode size={16} />
                            <span className='md:text-sm text-xs'>
                                Escanear código QR
                            </span>
                        </DialogTrigger>
                        <DialogContent className='sm:max-w-[425px] w-11/12'>
                            <DialogHeader>
                                <DialogTitle>Escanear código QR</DialogTitle>
                                <DialogDescription>
                                    Escaneaa código QR con tu aplicación TOTP
                                </DialogDescription>
                            </DialogHeader>

                            {twoFactorVerifyURI ? (
                                <>
                                    <div className='flex items-center justify-center'>
                                        <QRCode value={twoFactorVerifyURI} />
                                    </div>
                                    <div className='flex gap-2 items-center justify-center'>
                                        <p className='text-sm text-muted-foreground'>
                                            Copia este URI de verificación:
                                        </p>
                                        <CopyButton
                                            textToCopy={twoFactorVerifyURI}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className='flex flex-col gap-2'>
                                    <PasswordInput
                                        value={twoFaPassword}
                                        onChange={(
                                            e: React.ChangeEvent<HTMLInputElement>
                                        ) => setTwoFaPassword(e.target.value)}
                                        placeholder='Ingresa tu contraseña'
                                    />
                                    <Button
                                        onClick={async () => {
                                            if (twoFaPassword.length < 8) {
                                                toast.error(
                                                    'La contraseña debe tener al menos 8 caracteres'
                                                )
                                                return
                                            }
                                            await authClient.twoFactor.getTotpUri(
                                                {
                                                    password: twoFaPassword
                                                },
                                                {
                                                    onSuccess(context: {
                                                        data: {
                                                            totpURI: string
                                                        }
                                                    }) {
                                                        setTwoFactorVerifyURI(
                                                            context.data.totpURI
                                                        )
                                                    }
                                                }
                                            )
                                            setTwoFaPassword('')
                                        }}>
                                        Mostrar código QR
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                )}
                <Dialog
                    open={twoFactorDialog}
                    onOpenChange={setTwoFactorDialog}>
                    <DialogTrigger render={<Button
                        variant={
                            session?.user.twoFactorEnabled
                                ? 'destructive'
                                : 'outline'
                        }
                        className='gap-2' />}>
                        {session?.user.twoFactorEnabled ? (
                            <ShieldOff size={16} />
                        ) : (
                            <ShieldCheck size={16} />
                        )}
                        <span className='md:text-sm text-xs'>
                            {session?.user.twoFactorEnabled
                                ? 'Desactivar 2FA'
                                : 'Activar 2FA'}
                        </span>
                    </DialogTrigger>
                    <DialogContent className='sm:max-w-[425px] w-11/12'>
                        <DialogHeader>
                            <DialogTitle>
                                {session?.user.twoFactorEnabled
                                    ? 'Desactivar 2FA'
                                    : 'Activar 2FA'}
                            </DialogTitle>
                            <DialogDescription>
                                {session?.user.twoFactorEnabled
                                    ? 'Desactiva 2FA para tu cuenta'
                                    : 'Activa 2FA para tu cuenta'}
                            </DialogDescription>
                        </DialogHeader>

                        {twoFactorVerifyURI ? (
                            <div className='flex flex-col gap-2'>
                                <div className='flex items-center justify-center'>
                                    <QRCode value={twoFactorVerifyURI} />
                                </div>
                                <Label htmlFor='password'>
                                    Escanear código OTP
                                </Label>
                                <Input
                                    value={twoFaPassword}
                                    onChange={(
                                        e: React.ChangeEvent<HTMLInputElement>
                                    ) => setTwoFaPassword(e.target.value)}
                                    placeholder='Ingresa el código OTP'
                                />
                            </div>
                        ) : (
                            <div className='flex flex-col gap-2'>
                                <Label htmlFor='password'>Contraseña</Label>
                                <PasswordInput
                                    id='password'
                                    placeholder='Contraseña'
                                    value={twoFaPassword}
                                    onChange={(
                                        e: React.ChangeEvent<HTMLInputElement>
                                    ) => setTwoFaPassword(e.target.value)}
                                />
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                disabled={isPendingTwoFa}
                                onClick={async () => {
                                    if (
                                        twoFaPassword.length < 8 &&
                                        !twoFactorVerifyURI
                                    ) {
                                        toast.error(
                                            'La contraseña debe tener al menos 8 caracteres'
                                        )
                                        return
                                    }
                                    setIsPendingTwoFa(true)
                                    if (session?.user.twoFactorEnabled) {
                                        const res =
                                            await authClient.twoFactor.disable({
                                                password: twoFaPassword,
                                                fetchOptions: {
                                                    onError(context: {
                                                        error: {
                                                            message: string
                                                        }
                                                    }) {
                                                        toast.error(
                                                            context.error
                                                                .message
                                                        )
                                                    },
                                                    onSuccess() {
                                                        toast(
                                                            '2FA desactivado con éxito'
                                                        )
                                                        setTwoFactorDialog(
                                                            false
                                                        )
                                                    }
                                                }
                                            })
                                    } else {
                                        if (twoFactorVerifyURI) {
                                            await authClient.twoFactor.verifyTotp(
                                                {
                                                    code: twoFaPassword,
                                                    fetchOptions: {
                                                        onError(context: {
                                                            error: {
                                                                message: string
                                                            }
                                                        }) {
                                                            setIsPendingTwoFa(
                                                                false
                                                            )
                                                            setTwoFaPassword('')
                                                            toast.error(
                                                                context.error
                                                                    .message
                                                            )
                                                        },
                                                        onSuccess() {
                                                            toast(
                                                                '2FA activado con éxito'
                                                            )
                                                            setTwoFactorVerifyURI(
                                                                ''
                                                            )
                                                            setIsPendingTwoFa(
                                                                false
                                                            )
                                                            setTwoFaPassword('')
                                                            setTwoFactorDialog(
                                                                false
                                                            )
                                                        }
                                                    }
                                                }
                                            )
                                            return
                                        }
                                        const res =
                                            await authClient.twoFactor.enable({
                                                password: twoFaPassword,
                                                fetchOptions: {
                                                    onError(context: {
                                                        error: {
                                                            message: string
                                                        }
                                                    }) {
                                                        toast.error(
                                                            context.error
                                                                .message
                                                        )
                                                    },
                                                    onSuccess(ctx: {
                                                        data: {
                                                            totpURI: string
                                                        }
                                                    }) {
                                                        setTwoFactorVerifyURI(
                                                            ctx.data.totpURI
                                                        )
                                                        // toast.success("2FA enabled successfully");
                                                        // setTwoFactorDialog(false);
                                                    }
                                                }
                                            })
                                    }
                                    setIsPendingTwoFa(false)
                                    setTwoFaPassword('')
                                }}>
                                {isPendingTwoFa ? (
                                    <Loader2
                                        size={15}
                                        className='animate-spin'
                                    />
                                ) : session?.user.twoFactorEnabled ? (
                                    'Descativar 2FA'
                                ) : (
                                    'Activar 2FA'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
