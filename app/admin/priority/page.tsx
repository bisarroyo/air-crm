'use client'

import { EntityManager } from '@/components/admin/entity-manager'

export default function PriorityPage() {
    return (
        <div className='container mx-auto p-6'>
            <EntityManager
                title='Priority'
                nameField='priority'
                apiBase='priority'
            />
        </div>
    )
}
