import { NextRequest, NextResponse } from 'next/server'
import { collection, query, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const USERS_PER_PAGE = 20

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const searchQuery = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '1')

  if (!searchQuery || searchQuery.length < 2) {
    return NextResponse.json({
      results: [],
      totalResults: 0,
      totalPages: 0,
      page: 1
    })
  }

  try {
    const usersRef = collection(db, 'users')
    const searchLower = searchQuery.toLowerCase()
    
    // Tüm kullanıcıları çek (limit ile)
    // Not: Büyük ölçekli uygulamalar için Algolia veya ElasticSearch kullanılmalı
    const q = query(usersRef, limit(500))
    const snapshot = await getDocs(q)
    
    // Client-side filtreleme (case-insensitive)
    const allUsers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((user: any) => {
        const displayName = (user.displayName || '').toLowerCase()
        const email = (user.email || '').toLowerCase()
        return displayName.includes(searchLower) || email.includes(searchLower)
      })
    
    // Pagination
    const totalResults = allUsers.length
    const totalPages = Math.ceil(totalResults / USERS_PER_PAGE)
    const startIndex = (page - 1) * USERS_PER_PAGE
    const endIndex = startIndex + USERS_PER_PAGE
    const paginatedUsers = allUsers.slice(startIndex, endIndex)
    
    // Hassas bilgileri temizle
    const sanitizedUsers = paginatedUsers.map((user: any) => ({
      id: user.id,
      displayName: user.displayName || 'Anonim',
      photoURL: user.photoURL || null,
      bio: user.bio || '',
      createdAt: user.createdAt,
      stats: {
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        listsCount: user.listsCount || 0,
      }
    }))

    return NextResponse.json({
      results: sanitizedUsers,
      totalResults,
      totalPages,
      page
    })

  } catch (error) {
    console.error('User search error:', error)
    return NextResponse.json(
      {
        results: [],
        totalResults: 0,
        totalPages: 0,
        page: 1,
        error: 'Kullanıcı araması başarısız oldu'
      },
      { status: 500 }
    )
  }
}
