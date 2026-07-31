'use client'

import { useState, useRef, useCallback } from 'react'

interface UseVoiceSearchOptions {
  lang?: 'tr' | 'en'
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
}

interface UseVoiceSearchReturn {
  isListening: boolean
  isSupported: boolean
  start: () => void
  stop: () => void
}

/**
 * Sesli arama hook'u
 * Web Speech API kullanarak sesli arama yapar
 * 
 * @example
 * const { isListening, isSupported, start, stop } = useVoiceSearch({
 *   lang: 'tr',
 *   onResult: (text) => setQuery(text)
 * })
 */
export function useVoiceSearch(options: UseVoiceSearchOptions = {}): UseVoiceSearchReturn {
  const { lang = 'tr', onResult, onError } = options
  
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  
  // Browser desteği kontrolü
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!isSupported) {
      onError?.('Tarayıcınız sesli aramayı desteklemiyor')
      return
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                 (window as any).webkitSpeechRecognition
      
      const recognition = new SpeechRecognition()
      
      // Dil ayarı - dinamik
      recognition.lang = lang === 'tr' ? 'tr-TR' : 'en-US'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        onResult?.(transcript)
        setIsListening(false)
      }

      recognition.onerror = (event: any) => {
        const errorMessages: Record<string, string> = {
          'no-speech': 'Ses algılanamadı',
          'audio-capture': 'Mikrofon bulunamadı',
          'not-allowed': 'Mikrofon izni verilmedi',
          'network': 'Ağ hatası',
        }
        onError?.(errorMessages[event.error] || 'Sesli arama hatası')
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
      
    } catch (error) {
      onError?.('Sesli arama başlatılamadı')
      setIsListening(false)
    }
  }, [isSupported, lang, onResult, onError])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsListening(false)
    }
  }, [])

  return {
    isListening,
    isSupported,
    start,
    stop,
  }
}
