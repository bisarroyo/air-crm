import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers, referrals, logs } from '@/db/schema'

export async function POST(request: Request) {
    try {
        const body = await request.json()

        if (!body.name || !body.email || !body.phone || !body.travel_time) {
            return NextResponse.json(
                { error: 'Name, email, phone, and travel time are required' },
                { status: 400 }
            )
        }

        let referralId: number | undefined

        console.log('Received referral code:', body.referralCode)
        if (body.referralCode) {
            const [referral] = await db
                .select()
                .from(referrals)
                .where(eq(referrals.code, body.referralCode))
                .limit(1)

            if (referral) {
                referralId = referral.id
            }
        }
        const validateCurrentCustomer = await db
            .select()
            .from(customers)
            .where(eq(customers.email, body.email))
            .limit(1)

        if (validateCurrentCustomer.length > 0) {
            const existing = validateCurrentCustomer[0]
            const updateData: Record<string, string | number | null> = {
                name: body.name,
                phone: body.phone,
                travelTime: body.travel_time,
                statusId: 1,
                priorityId: 1,
                referralId: referralId || null
            }
            await db
                .update(customers)
                .set(updateData)
                .where(eq(customers.email, body.email))

            const changedFields: Record<
                string,
                { from: string | number | Date | null | undefined; to: string | number | Date | null | undefined }
            > = {}
            for (const [key, newValue] of Object.entries(updateData)) {
                const oldValue = existing[key as keyof typeof existing]
                if (String(oldValue) !== String(newValue)) {
                    changedFields[key] = { from: oldValue, to: newValue }
                }
            }

            if (Object.keys(changedFields).length > 0) {
                await db.insert(logs).values({
                    customerId: existing.id,
                    action: 'lead_updated',
                    changes: JSON.stringify(changedFields)
                })
            }

            return NextResponse.json(
                { message: 'Customer updated successfully' },
                { status: 200 }
            )
        }

        const [newCustomer] = await db
            .insert(customers)
            .values({
                name: body.name,
                email: body.email,
                phone: body.phone,
                travelTime: body.travel_time,
                statusId: 1,
                priorityId: 1,
                referralId: referralId || null,
                assignedTo: '0vd84cJDrYloFlFJRdErhuztO9J9jwaI'
            })
            .returning()

        await db.insert(logs).values({
            customerId: newCustomer.id,
            action: 'lead_created',
            changes: JSON.stringify({
                name: body.name,
                email: body.email,
                phone: body.phone,
                travelTime: body.travel_time,
                referralCode: body.referralCode || null
            })
        })

        return NextResponse.json(newCustomer, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error)?.message || 'Failed to create lead' },
            { status: 500 }
        )
    }
}
