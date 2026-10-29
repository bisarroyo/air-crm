'use client'

import { EntityManager } from '@/components/admin/entity-manager'

export default function TravelStatusPage() {
    return (
        <div className='container mx-auto p-6'>
            <EntityManager
                title='Estado de viaje'
                nameField='status'
                apiBase='travel/status'
            />
        </div>
    )
}
