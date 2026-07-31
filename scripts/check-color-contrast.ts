#!/usr/bin/env tsx

/**
 * Renk Kontrastı Kontrol Script'i
 * Rimora tema renklerinin WCAG uyumluluğunu kontrol eder
 */

import { checkRimoraThemeContrast } from '../src/lib/utils/color-contrast'

console.log('🎨 Rimora Tema Renk Kontrastı Kontrolü\n')
console.log('WCAG 2.1 Standartları:')
console.log('  AA  - Normal metin: 4.5:1, Büyük metin: 3:1')
console.log('  AAA - Normal metin: 7:1, Büyük metin: 4.5:1\n')

const results = checkRimoraThemeContrast()

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📱 LIGHT THEME')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

results.light.forEach((result) => {
  const icon = result.passes ? '✅' : '❌'
  const status = result.level === 'AAA' ? '🌟 AAA' : result.level === 'AA' ? '✓ AA' : '✗ FAIL'
  
  console.log(`${icon} ${result.pair.name}`)
  console.log(`   Kontrast Oranı: ${result.ratio}:1`)
  console.log(`   Seviye: ${status}`)
  console.log(`   Foreground: ${result.pair.foreground}`)
  console.log(`   Background: ${result.pair.background}\n`)
})

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🌙 DARK THEME')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

results.dark.forEach((result) => {
  const icon = result.passes ? '✅' : '❌'
  const status = result.level === 'AAA' ? '🌟 AAA' : result.level === 'AA' ? '✓ AA' : '✗ FAIL'
  
  console.log(`${icon} ${result.pair.name}`)
  console.log(`   Kontrast Oranı: ${result.ratio}:1`)
  console.log(`   Seviye: ${status}`)
  console.log(`   Foreground: ${result.pair.foreground}`)
  console.log(`   Background: ${result.pair.background}\n`)
})

// Özet
const lightPasses = results.light.filter(r => r.passes).length
const darkPasses = results.dark.filter(r => r.passes).length
const totalTests = results.light.length + results.dark.length
const totalPasses = lightPasses + darkPasses

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 ÖZET')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log(`Light Theme: ${lightPasses}/${results.light.length} geçti`)
console.log(`Dark Theme: ${darkPasses}/${results.dark.length} geçti`)
console.log(`\nToplam: ${totalPasses}/${totalTests} geçti`)

if (totalPasses === totalTests) {
  console.log('\n🎉 Tüm renk kontrastları WCAG standartlarına uygun!')
  process.exit(0)
} else {
  console.log('\n⚠️  Bazı renk kontrastları WCAG standartlarına uygun değil!')
  process.exit(1)
}
