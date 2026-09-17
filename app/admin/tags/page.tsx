'use client'

import { EntityManager } from '@/components/admin/entity-manager'

export default function TagsPage() {
    return (
        <div className='container mx-auto p-6'>
            <EntityManager title='Tag' nameField='tag' apiBase='tags' />
        </div>
    )
}