import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface VisuallyHiddenProps {
  children: ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
}

/**
 * Visually Hidden Component
 * Screen reader'lar için görünür ama ekranda gizli içerik
 * 
 * Kullanım:
 * - Icon-only button'larda açıklama metni
 * - Form label'ları (görsel olarak gizli ama erişilebilir)
 * - Ek bağlam bilgisi
 */
export function VisuallyHidden({
  children,
  className,
  as: Component = 'span',
}: VisuallyHiddenProps) {
  return (
    <Component className={cn('sr-only', className)}>
      {children}
    </Component>
  )
}
