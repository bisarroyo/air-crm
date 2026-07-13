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
            <h1 className='text-2xl font-medium'>Admin Panel</h1>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                <Link href='/admin/users'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Users</CardTitle>
                            <CardDescription>
                                Manage user accounts
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Create, edit, ban, delete, and manage user
                                accounts.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/status'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Status</CardTitle>
                            <CardDescription>
                                Manage customer statuses
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Create, edit, activate, or deactivate status
                                options.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/priority'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Priority</CardTitle>
                            <CardDescription>
                                Manage customer priorities
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Create, edit, activate, or deactivate priority
                                levels.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href='/admin/referrals'>
                    <Card className='cursor-pointer transition-all hover:ring-2 hover:ring-primary/30'>
                        <CardHeader>
                            <CardTitle>Referrals</CardTitle>
                            <CardDescription>
                                Manage referral codes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className='text-sm text-muted-foreground'>
                                Create, edit, or delete referral codes and
                                link them to users.
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
