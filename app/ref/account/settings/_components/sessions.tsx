'use client'
import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { Session } from '@/lib/auth-types'
import { Laptop, Loader2, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { UAParser } from 'ua-parser-js'

interface SessionData {
    id: string
    token: string
    userAgent?: string | null
    createdAt: Date
    expiresAt: Date
    impersonatedBy?: string | null
    activeOrganizationId?: string | null
}

export default function Sessions({
    currentSession
}: {
    currentSession: Session | null
}) {
    const { data: sessions, refetch } = useQuery<SessionData[]>({
        queryKey: ['sessions'],
        queryFn: async () => {
            const { data, error } = await authClient.listSessions()
            if (error) throw new Error(error.message || 'Failed to fetch sessions')
            return data
        }
    })
    const [isTerminating, setIsTerminating] = useState<string>()

    const router = useRouter()

    const handleSessionTerminate = async (session: SessionData) => {
        setIsTerminating(session.id)
        const res = await authClient.revokeSession({
            token: session.token
        })

        if (res.error) {
            toast.error(res.error.message)
        } else {
            toast.success('Sesión terminada con éxito')
            refetch()
        }
        if (session.id === currentSession?.session.id)
            router.refresh()
        setIsTerminating(undefined)
    }

    return (
        <div className='border-l-2 px-2 w-max gap-1 flex flex-col'>
            <p className='text-xs font-medium '>Sesiones activas</p>
            {sessions
                ?.filter((session: SessionData) => session.userAgent)
                .map((session: SessionData) => (
                    <div key={session.id}>
                        <div className='flex items-center gap-2 text-sm text-black font-medium dark:text-white'>
                            {new UAParser(
                                session.userAgent || ''
                            ).getDevice().type === 'mobile' ? (
                                <Smartphone />
                            ) : (
                                <Laptop size={16} />
                            )}
                            {new UAParser(session.userAgent || '').getOS()
                                .name || session.userAgent}
                            ,{' '}
                            {
                                new UAParser(
                                    session.userAgent || ''
                                ).getBrowser().name
                            }
                            <button
                                className='text-red-500 opacity-80 cursor-pointer text-xs underline'
                                onClick={() => handleSessionTerminate(session)}>
                                {isTerminating === session.id ? (
                                    <Loader2
                                        size={15}
                                        className='animate-spin'
                                    />
                                ) : session.id ===
                                  currentSession?.session.id ? (
                                    'Cerrar sesión actual'
                                ) : (
                                    'Terminar'
                                )}
                            </button>
                        </div>
                    </div>
                ))}
        </div>
    )
}
