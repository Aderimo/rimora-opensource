'use client'

import Link from 'next/link'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Number */}
        <div className="relative mb-8">
          <span className="text-[150px] md:text-[200px] font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 bg-clip-text text-transparent opacity-20">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icons.film className="h-20 w-20 text-muted-foreground" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl md:text-3xl font-bold mb-4">
          Sayfa Bulunamadı
        </h1>
        <p className="text-muted-foreground mb-8">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir. 
          Ana sayfaya dönerek içerikleri keşfetmeye devam edebilirsiniz.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <Icons.home className="h-4 w-4" />
              Ana Sayfa
            </Button>
          </Link>
          <Link href="/arama">
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
              <Icons.search className="h-4 w-4" />
              İçerik Ara
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
