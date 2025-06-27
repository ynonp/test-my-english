'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Volume2 } from 'lucide-react'
const categories = ['vocabulary', 'grammar', 'fluency'] as const;

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'hero' | 'conversation' | 'assessment'>('hero')
  const [showTranscription, setShowTranscription] = useState(true)
  const [fastMode, setFastMode] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [conversation, setConversation] = useState<Array<{speaker: 'teacher' | 'user', text: string}>>([])
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [topicsCovered, setTopicsCovered] = useState<string[]>([])
  const [assessmentData, setAssessmentData] = useState<{
    vocabulary: {score: number, feedback: string},
    grammar: {score: number, feedback: string}, 
    fluency: {score: number, feedback: string},
    overall: {level: string, summary: string}
  } | null>(null)
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const [isFinishingConversation, setIsFinishingConversation] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const handleEndConversation = useCallback(async () => {
    try {
      setIsFinishingConversation(true)
      
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation }),
      })

      if (response.ok) {
        const assessment = await response.json()
        setAssessmentData(assessment)
      }
    } catch (error) {
      console.error('Error getting assessment:', error)
    } finally {
      setIsFinishingConversation(false)
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    setCurrentScreen('assessment')
  }, [conversation])

  // Timer effect for 8-minute limit
  useEffect(() => {
    if (startTime && currentScreen === 'conversation') {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60) // minutes
        setTimeElapsed(elapsed)
        
        if (elapsed >= 8) {
          // Time's up - trigger assessment
          handleEndConversation()
        }
      }, 1000)
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
    }
  }, [startTime, currentScreen, handleEndConversation])

  const startConversation = async () => {
    setCurrentScreen('conversation')
    setStartTime(new Date())
    const initialMessage = "Hello! I'm your English teacher. Tell me about yourself - what's your name and where are you from?"
    setConversation([{speaker: 'teacher', text: initialMessage}])
    await speakText(initialMessage, fastMode)
  }

  const generateTeacherResponse = async (userResponse: string) => {
    try {
      setIsGeneratingResponse(true)
      
      // Create messages array for OpenAI
      const messages = conversation.map(msg => ({
        role: msg.speaker === 'teacher' ? 'assistant' : 'user',
        content: msg.text
      }))
      
      // Add the new user response
      messages.push({ role: 'user', content: userResponse })
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          topicsCovered,
          timeElapsed
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate response')
      }

      const data = await response.json()
      const teacherResponse = data.response
      
      // Check if the teacher is ending the conversation
      if (teacherResponse.toLowerCase().includes('assess') || 
          teacherResponse.toLowerCase().includes('good sense of your english level')) {
        setTimeout(() => handleEndConversation(), 2000)
      }
      
      return teacherResponse
    } catch (error) {
      console.error('Error generating teacher response:', error)
      return "Could you tell me more about that?"
    } finally {
      setIsGeneratingResponse(false)
    }
  }


  const speakText = async (text: string, useFastMode = false) => {
    try {
      setIsSpeaking(true)
      
      // Set aggressive timeout for TTS API
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, useFastMode }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.fallback) {
          throw new Error('API suggested fallback')
        }
        throw new Error('Failed to generate speech')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setIsSpeaking(false)
      }
      
      audio.onerror = () => {
        setIsSpeaking(false)
        // Try browser TTS on audio error
        fallbackToBrowserTTS(text)
      }
      
      await audio.play()
    } catch (error) {
      console.error('Error playing OpenAI TTS:', error)
      setIsSpeaking(false)
      // Fast fallback to browser TTS
      fallbackToBrowserTTS(text)
    }
  }

  const fallbackToBrowserTTS = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0 // Faster rate for responsiveness
      utterance.pitch = 1.1 // Slightly higher pitch for clarity
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      speechSynthesis.speak(utterance)
    }
  }

  const startRecording = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      
      setIsRecording(true)
      recognition.start()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = async (event: any) => {
        const userText = event.results[0][0].transcript
        setConversation(prev => [...prev, {speaker: 'user', text: userText}])
        
        setIsRecording(false)
        
        // Generate dynamic teacher response
        const teacherResponse = await generateTeacherResponse(userText)
        
        // Add teacher response to conversation
        setConversation(prev => [...prev, {speaker: 'teacher', text: teacherResponse}])
        
        // Speak the response
        await speakText(teacherResponse, fastMode)
      }
      
      recognition.onerror = () => {
        setIsRecording(false)
      }
    }
  }


  if (currentScreen === 'hero') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="mb-8 p-8 bg-white rounded-2xl shadow-lg">
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#007BFF] to-[#0056b3] rounded-full flex items-center justify-center">
              <Volume2 className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-heading text-[#212529] mb-4">
              Uptick English Level Assessment
            </h1>
            <p className="text-lg font-body text-[#212529] mb-8">
              Have a natural conversation with our AI teacher to discover your English proficiency level
            </p>
            <button
              onClick={startConversation}
              className="bg-[#007BFF] hover:bg-[#0056b3] text-white px-8 py-4 rounded-md text-xl font-semibold transition-colors shadow-lg"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentScreen === 'conversation') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] p-4 relative">
        {isFinishingConversation && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center shadow-xl">
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Finishing Conversation
              </h3>
              <p className="text-gray-600">
                Preparing your assessment...
              </p>
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-heading text-[#212529]">English Assessment Conversation</h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-[#212529]">
                  Time: {timeElapsed}/8 minutes
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={fastMode}
                    onChange={(e) => setFastMode(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-[#212529]">Fast mode</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showTranscription}
                    onChange={(e) => setShowTranscription(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-[#212529]">Show text</span>
                </label>
              </div>
            </div>
            
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {conversation.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.speaker === 'user' 
                      ? 'bg-[#007BFF] text-white ml-4' 
                      : 'bg-gray-200 text-[#212529] mr-4'
                  }`}>
                    {showTranscription && (
                      <div className="text-xs opacity-75 mb-1">
                        {msg.speaker === 'user' ? 'You' : 'Teacher'}
                      </div>
                    )}
                    {showTranscription ? msg.text : '🎵 Audio message'}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="text-center">
              {isSpeaking && (
                <div className="mb-4 text-sm text-[#212529] animate-pulse">
                  🎙️ Teacher is speaking...
                </div>
              )}
              {isGeneratingResponse && (
                <div className="mb-4 text-sm text-[#212529] animate-pulse">
                  🤔 Teacher is thinking...
                </div>
              )}
              <div className="flex justify-center items-center space-x-4">
                <button
                  onClick={startRecording}
                  disabled={isRecording || isSpeaking || isGeneratingResponse}
                  className={`inline-flex items-center space-x-2 px-6 py-3 rounded-md text-white font-semibold transition-all ${
                    isRecording 
                      ? 'bg-red-500 animate-pulse' 
                      : (isSpeaking || isGeneratingResponse)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[#007BFF] hover:bg-[#0056b3]'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                  <span>
                    {isRecording ? 'Listening...' : (isSpeaking || isGeneratingResponse) ? 'Wait...' : 'Click to Speak'}
                  </span>
                </button>
                
                <button
                  onClick={handleEndConversation}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
                >
                  Finish Conversation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentScreen === 'assessment') {
    if (!assessmentData) {
      return (
        <div className="min-h-screen bg-white p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007BFF] mx-auto mb-4"></div>
            <p className="text-[#212529]">Analyzing your English level...</p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-heading text-center text-[#212529] mb-4">
              Your English Level Assessment
            </h2>
            
            {assessmentData.overall && (
              <div className="text-center mb-8 p-4 bg-[#F8F9FA] rounded-lg">
                <h3 className="text-xl font-heading text-[#007BFF] mb-2">
                  Overall Level: {assessmentData.overall.level}
                </h3>
                <p className="text-[#212529]">{assessmentData.overall.summary}</p>
              </div>
            )}
            
            <div className="grid md:grid-cols-3 gap-6">
              {categories.map((category) => {
                const data = assessmentData[category]
                if (!data) return null
                
                return (
                  <div key={category} className="text-center p-6 bg-[#F8F9FA] rounded-lg">
                    <h3 className="text-xl font-heading text-[#212529] mb-3 capitalize">
                      {category}
                    </h3>
                    <div className="text-4xl font-bold text-[#007BFF] mb-3">
                      {data.score}/100
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                      <div 
                        className="bg-[#007BFF] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${data.score}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-[#212529]">
                      {data.feedback}
                    </p>
                  </div>
                )
              })}
            </div>
            
            <div className="text-center mt-8">
              <button
                onClick={() => {
                  setCurrentScreen('hero')
                  setConversation([])
                  setStartTime(null)
                  setTimeElapsed(0)
                  setTopicsCovered([])
                  setAssessmentData(null)
                  setIsRecording(false)
                  setIsSpeaking(false)
                  setIsGeneratingResponse(false)
                  setIsFinishingConversation(false)
                  // Keep fastMode setting for user preference
                }}
                className="bg-[#007BFF] hover:bg-[#0056b3] text-white px-8 py-3 rounded-md font-semibold transition-colors"
              >
                Take Assessment Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}