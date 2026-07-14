import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import UserCard from './settings/user-card'

export default async function DashboardPage() {
    const [session] = await Promise.all([
        auth.api.getSession({
            headers: await headers()
        })
    ]).catch(() => {
        throw redirect('/signin')
    })

    return (
        <div className='w-full flex items-center justify-center'>
            <div className='flex gap-4 flex-col max-w-7xl w-full mx-auto mt-4'>
                <UserCard />
            </div>
        </div>
    )
}
