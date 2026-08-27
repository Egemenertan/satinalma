'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  MessageCircle, 
  Send, 
  X, 
  Bot, 
  TrendingUp, 
  Package, 
  Building2, 
  DollarSign,
  Clock,
  Lightbulb,
  Minimize2,
  Maximize2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  type?: 'suggestion' | 'data' | 'normal' | 'error'
}

interface QuickAction {
  label: string
  icon: React.ReactNode
  query: string
  category: string
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '🌍 **Merhaba Burçin Bey! Ben DOVEC AI\'yım** 🤖\n\nGelişmiş satın alma sistemi asistanınızım. Dashboard verilerinizi analiz ederek size akıllı öneriler sunabilirim.\n\n**✨ Neler yapabilirim:**\n• 📊 Gerçek zamanlı veri analizi\n• 🔍 Şantiye bazlı raporlama\n• 💰 Maliyet optimizasyonu\n• 📈 Trend analizi ve öngörüler\n• 🚨 Kritik durumları tespit etme\n\n**💬 Örnek sorular:**\n• "Four Seasons şantiyesi bu hafta ne kadar harcadı?"\n• "En çok geciken siparişler hangileri?"\n• "Maliyetlerimi nasıl düşürebilirim?"\n\n*Konuşma geçmişinizi hatırlıyorum, istediğiniz konuda devam edebiliriz!* 🎯',
      sender: 'ai',
      timestamp: new Date(),
      type: 'normal'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickActions: QuickAction[] = [
    {
      label: 'Bugünkü talepler',
      icon: <Package className="h-4 w-4" />,
      query: 'Bugün kaç tane yeni talep geldi?',
      category: 'Talepler'
    },
    {
      label: 'En aktif şantiyeler',
      icon: <Building2 className="h-4 w-4" />,
      query: 'En aktif şantiyeler hangileri?',
      category: 'Şantiyeler'
    },
    {
      label: 'Toplam sipariş tutarı',
      icon: <DollarSign className="h-4 w-4" />,
      query: 'Bu ay toplam sipariş tutarı ne kadar?',
      category: 'Finans'
    },
    {
      label: 'Bekleyen onaylar',
      icon: <Clock className="h-4 w-4" />,
      query: 'Kaç tane onay bekleyen talep var?',
      category: 'Onaylar'
    },
    {
      label: 'İyileştirme önerileri',
      icon: <Lightbulb className="h-4 w-4" />,
      query: 'Satın alma sürecimi nasıl iyileştirebilirim?',
      category: 'Öneriler'
    },
    {
      label: 'Aylık trend analizi',
      icon: <TrendingUp className="h-4 w-4" />,
      query: 'Bu ayın talep trendi nasıl?',
      category: 'Analiz'
    }
  ]

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (messageContent?: string) => {
    const content = messageContent || inputValue.trim()
    if (!content) return

    // Kullanıcı mesajını ekle
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsThinking(true)

    // AI mesajı için placeholder oluştur
    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: Message = {
      id: aiMessageId,
      content: '...',
      sender: 'ai',
      timestamp: new Date(),
      type: 'normal'
    }

    // Thinking mesajını ekle
    setMessages(prev => [...prev, aiMessage])

    try {
      // Konuşma geçmişini hazırla (AI için format)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))

      // AI API çağrısı - Streaming ile
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          context: 'dashboard',
          conversationHistory: conversationHistory
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      // Streaming response'u handle et
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Response body reader not available')
      }

      let accumulatedContent = ''
      let hasStartedStreaming = false

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.error) {
                // Hata durumu
                setIsThinking(false)
                setStreamingMessageId(null)
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: data.error, type: 'error' }
                    : msg
                ))
                return
              }

              if (data.done) {
                // Stream tamamlandı
                setStreamingMessageId(null)
                if (data.type) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, type: data.type }
                      : msg
                  ))
                }
                return
              }

              if (data.content) {
                // İlk content geldiğinde thinking'i durdur ve streaming'e geç
                if (!hasStartedStreaming) {
                  setIsThinking(false)
                  setStreamingMessageId(aiMessageId)
                  hasStartedStreaming = true
                }
                
                // İçeriği biriktir ve güncelle
                accumulatedContent += data.content
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: accumulatedContent, type: data.type || 'normal' }
                    : msg
                ))
              }
            } catch (parseError) {
              console.error('JSON parse error:', parseError)
            }
          }
        }
      }

    } catch (error) {
      console.error('AI Chat Error:', error)
      
      // Thinking ve streaming'i durdur
      setIsThinking(false)
      setStreamingMessageId(null)
      
      // Hata durumunda AI mesajını güncelle (teknik hata detayı kullanıcıya asla gösterilmez)
      const errorContent = `🤖 **Bağlantı Sorunu - Burçin Bey**\n\nÜzgünüm Burçin Bey, DOVEC AI servislerine şu anda erişemiyorum.\n\nLütfen birkaç dakika sonra tekrar deneyin veya sorunuz devam ediyorsa sistem yöneticisiyle iletişime geçin.`
      
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: errorContent, type: 'error' }
          : msg
      ))
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <div className="flex items-center gap-2">
          {/* AI Text - Yuvarlağın sol dışında */}
          <span className="text-[#071E51] font-bold text-sm bg-white px-2 py-1 rounded-lg shadow-lg border border-gray-200">
            AI
          </span>
          {/* World Button - Yuvarlak buton */}
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-white hover:bg-gray-100 shadow-2xl transition-all duration-300 hover:scale-110 border-2 border-gray-200 p-2"
            size="lg"
          >
            <img 
              src={`${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/satinalma`}/dunya.png`}
              alt="AI Asistan" 
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                // Fallback to world emoji if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '🌍';
                  parent.className += ' text-2xl flex items-center justify-center';
                }
              }}
            />
          </Button>
        </div>
      </div>
    )
  }

      return (
      <div className="fixed bottom-4 right-4 left-4 sm:bottom-6 sm:right-6 sm:left-auto z-50">
        <Card className={`${isMinimized 
          ? 'w-full sm:w-80 h-16' 
          : 'w-full sm:w-96 h-[580px] max-h-[calc(100vh-2rem)] sm:max-h-[580px]'
        } bg-white shadow-2xl border-0 rounded-3xl transition-all duration-300`}>
        
        {/* Header */}
        <CardHeader className="p-4 text-white rounded-t-3xl" style={{ backgroundColor: '#071E51' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* AI Text - Yuvarlağın sol dışında */}
                <span className="text-white font-bold text-xs bg-white/20 px-2 py-1 rounded">
                  AI
                </span>
                {/* World Image - Yuvarlak */}
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1">
                  <img 
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/satinalma`}/dunya.png`}
                    alt="AI Asistan" 
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      // Fallback to world emoji if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '🌍';
                        parent.className += ' text-xl flex items-center justify-center';
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">DOVEC AI</h3>
                {!isMinimized && (
                  <p className="text-sm text-gray-300">Veri analizi ve öneriler</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsMinimized(!isMinimized)}
                variant="ghost"
                size="sm"
                className="text-white p-2"
                style={{ 
                  backgroundColor: 'transparent' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="sm"
                className="text-white p-2"
                style={{ 
                  backgroundColor: 'transparent' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[calc(100vh-8rem)] sm:h-[516px] overflow-hidden">
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] p-3 rounded-2xl ${
                      message.sender === 'user'
                        ? 'text-white rounded-br-md'
                        : message.type === 'suggestion'
                        ? 'bg-yellow-50 text-gray-900 border border-yellow-200 rounded-bl-md'
                        : message.type === 'data'
                        ? 'bg-blue-50 text-gray-900 border border-blue-200 rounded-bl-md'
                        : message.type === 'error'
                        ? 'bg-red-50 text-gray-900 border border-red-200 rounded-bl-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                    style={message.sender === 'user' ? { backgroundColor: '#071E51' } : {}}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {/* Thinking animasyonu */}
                      {isThinking && message.id === messages[messages.length - 1]?.id ? (
                        <span className="flex items-center space-x-1">
                          <span className="text-gray-500">Düşünüyor</span>
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </span>
                      ) : (
                        <>
                          {message.content}
                          {/* Streaming cursor - sadece aktif streaming mesajında */}
                          {streamingMessageId === message.id && (
                            <span className="inline-block w-0.5 h-4 ml-1 bg-gray-600 animate-pulse"></span>
                          )}
                        </>
                      )}
                    </p>
                    <p className={`text-xs mt-2 ${
                      message.sender === 'user' ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-md">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions - Sadece ilk mesajda */}
            {messages.length === 1 && (
              <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600 mb-3 font-medium">Hızlı Sorular:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickActions.slice(0, 4).map((action, index) => (
                    <Button
                      key={index}
                      onClick={() => handleSendMessage(action.query)}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto p-2 rounded-xl border-gray-200 hover:bg-gray-100 text-left justify-start"
                    >
                      <div className="flex items-center gap-2">
                        {action.icon}
                        <span className="truncate">{action.label}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area - Card içinde, en altta */}
            <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Soru sorun..."
                  className="flex-1 rounded-xl border-gray-200 focus:border-black text-base
                  "
                  disabled={isTyping || isThinking}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isTyping || isThinking}
                  className="rounded-xl px-3 sm:px-4 text-white"
                  style={{ backgroundColor: '#071E51' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0a2660'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#071E51'}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

          </CardContent>
        )}
      </Card>
    </div>
  )
}
