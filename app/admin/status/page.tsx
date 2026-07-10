'use client'

import { EntityManager } from '@/components/admin/entity-manager'

export default function StatusPage() {
    return (
        <div className='container mx-auto p-6'>
            <EntityManager
                title='Status'
                nameField='status'
                apiBase='status'
            />
        </div>
    )
}
