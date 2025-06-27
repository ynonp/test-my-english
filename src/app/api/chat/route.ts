import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { messages, topicsCovered, timeElapsed } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    const systemPrompt = `You are an experienced English teacher conducting a conversational English assessment. Your goal is to naturally assess the student's English proficiency through a flowing conversation.

TOPICS TO COVER (aim to cover as many as possible in 8 minutes):
- Personal introduction (name, age, where they're from)
- Family situation (married, children, living situation)
- Work or studies
- Hobbies and interests
- Daily routines
- Future plans or dreams
- Travel experiences
- Food preferences

ALREADY COVERED TOPICS: ${topicsCovered.join(', ') || 'none'}
TIME ELAPSED: ${timeElapsed} minutes

ASSESSMENT CRITERIA - Pay attention to:
- Vocabulary range and complexity
- Grammar accuracy and sentence structure
- Fluency and natural speech patterns
- Pronunciation clarity (you can't hear but infer from their responses)
- Comprehension of your questions

CONVERSATION GUIDELINES:
1. Keep responses conversational and encouraging
2. Ask follow-up questions based on their answers
3. Gradually increase complexity as appropriate
4. Show genuine interest in their responses
5. Don't rush - let them elaborate
6. If they give short answers, encourage them to explain more
7. Use varied question types (open-ended, specific, opinion-based)

If the time is approaching 8 minutes or you feel you have enough information, naturally conclude the conversation and indicate you're ready to provide the assessment by saying something like "Thank you for sharing so much with me! I think I have a good sense of your English level now."

Keep your responses to 1-2 sentences maximum. Be warm, encouraging, and professional.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 150,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "I'm sorry, could you repeat that?"

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}