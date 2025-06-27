import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Simple in-memory cache for common phrases
const audioCache = new Map<string, Buffer>()

// Common teacher phrases to pre-cache
const commonPhrases = [
  "Could you tell me more about that?",
  "That's interesting! What else can you share?",
  "Great! Can you elaborate on that?",
  "I see. Tell me more.",
  "That sounds wonderful!",
  "How interesting!",
  "Could you give me more details?",
  "Thank you for sharing!",
]

// Pre-generate common phrases on server start
async function preGenerateCommonPhrases() {
  for (const phrase of commonPhrases) {
    if (!audioCache.has(phrase)) {
      try {
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'nova',
          input: phrase,
          speed: 1.0, // Normal speed for responsiveness
        })
        const buffer = Buffer.from(await mp3.arrayBuffer())
        audioCache.set(phrase, buffer)
      } catch (error) {
        console.error(`Failed to pre-generate phrase: ${phrase}`, error)
      }
    }
  }
}

// Initialize cache on first request
let cacheInitialized = false

export async function POST(request: NextRequest) {
  try {
    const { text, useFastMode } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Initialize cache if not done
    if (!cacheInitialized) {
      preGenerateCommonPhrases().catch(console.error)
      cacheInitialized = true
    }

    // Check cache first
    if (audioCache.has(text)) {
      const cachedBuffer = audioCache.get(text)!
      return new NextResponse(cachedBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cachedBuffer.length.toString(),
          'X-Cache': 'HIT',
        },
      })
    }

    // For fast mode or short text, use faster settings
    const speed = useFastMode || text.length < 50 ? 1.1 : 1.0

    // Create with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1', // Fastest model
        voice: 'nova',
        input: text,
        speed: speed,
      })

      clearTimeout(timeoutId)
      const buffer = Buffer.from(await mp3.arrayBuffer())
      
      // Cache short responses for potential reuse
      if (text.length < 100) {
        audioCache.set(text, buffer)
        // Limit cache size
        if (audioCache.size > 50) {
          const firstKey = audioCache.keys().next().value
          audioCache.delete(firstKey)
        }
      }
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
          'X-Cache': 'MISS',
        },
      })
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    console.error('TTS API Error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate speech',
      fallback: true // Signal to use browser TTS
    }, { status: 500 })
  }
}