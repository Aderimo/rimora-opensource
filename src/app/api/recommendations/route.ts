import { NextRequest, NextResponse } from 'next/server'
import { getRecommendationsForUser } from '@/lib/recommendations'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        const recommendations = await getRecommendationsForUser(userId)

        return NextResponse.json({ results: recommendations })
    } catch (error) {
        console.error('Error in recommendations API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
