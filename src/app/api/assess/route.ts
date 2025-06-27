import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { conversation } = await request.json()

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json({ error: 'Conversation array is required' }, { status: 400 })
    }

    // Extract only user responses for analysis
    const userResponses = conversation
      .filter((msg: {speaker: string, text: string}) => msg.speaker === 'user')
      .map((msg: {speaker: string, text: string}) => msg.text)
      .join(' ')

    const assessmentPrompt = `As an experienced English teacher, analyze this student's English conversation responses and provide detailed scores and feedback.

STUDENT RESPONSES:
${userResponses}

Please analyze and score the following areas on a scale of 0-100:

1. VOCABULARY (0-100):
- Range of vocabulary used
- Appropriateness of word choices
- Use of complex vs simple words
- Variety in expression

2. GRAMMAR (0-100):
- Sentence structure accuracy
- Correct use of tenses
- Subject-verb agreement
- Use of articles, prepositions, etc.

3. FLUENCY (0-100):
- Natural flow of speech
- Ability to express ideas clearly
- Coherence and organization of thoughts
- Confidence in communication

Please respond in this exact JSON format:
{
  "vocabulary": {
    "score": <number>,
    "feedback": "<specific feedback about vocabulary>"
  },
  "grammar": {
    "score": <number>,
    "feedback": "<specific feedback about grammar>"
  },
  "fluency": {
    "score": <number>,
    "feedback": "<specific feedback about fluency>"
  },
  "overall": {
    "level": "<Beginner|Elementary|Intermediate|Upper-Intermediate|Advanced>",
    "summary": "<overall assessment summary>"
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert English language assessor. Analyze the student responses and provide accurate, constructive feedback.' },
        { role: 'user', content: assessmentPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })

    const response = completion.choices[0]?.message?.content
    
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response
    const assessment = JSON.parse(response)

    return NextResponse.json(assessment)
  } catch (error) {
    console.error('Assessment API Error:', error)
    return NextResponse.json({ error: 'Failed to generate assessment' }, { status: 500 })
  }
}