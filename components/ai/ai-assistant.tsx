'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  X,
  Send,
  Loader2,
  Bot,
  Upload,
  FileText,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  file?: {
    name: string;
    analysis?: any;
  };
}

interface AISettings {
  greeting: string;
  enabled: boolean;
  system_prompt: string;
}

const DEFAULT_AI_SETTINGS: AISettings = {
  greeting: 'Cześć! Jestem bezpłatnym asystentem KORIX3D. Mogę sprawdzić materiały, kolory, stany magazynowe i pomóc w wycenie druku 3D.',
  enabled: true,
  system_prompt: ''
};

const SUGGESTED_QUESTIONS = [
  'Jakie materiały są dostępne?',
  'Ile trwa produkcja?',
  'Jakie są ceny druku 3D?',
  'Czy macie PLA w kolorze czarnym?'
];

function buildMessagesPayload(messages: Message[], fullContent: string) {
  return [
    ...messages
      .filter((message) => message.id !== 'greeting')
      .map((message) => ({
        role: message.role,
        content: message.file?.analysis ? `[Plik: ${message.file.name}] ${message.content}` : message.content
      })),
    { role: 'user', content: fullContent }
  ];
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileAnalysis, setFileAnalysis] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('ai_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['greeting', 'enabled', 'system_prompt']);

        if (!data) {
          setSettings(DEFAULT_AI_SETTINGS);
          return;
        }

        const settingsData = data as Array<{ setting_key: string; setting_value: string }>;
        setSettings({
          greeting: settingsData.find((setting) => setting.setting_key === 'greeting')?.setting_value || DEFAULT_AI_SETTINGS.greeting,
          enabled: settingsData.find((setting) => setting.setting_key === 'enabled')?.setting_value !== 'false',
          system_prompt: settingsData.find((setting) => setting.setting_key === 'system_prompt')?.setting_value || ''
        });
      } catch (error) {
        console.error('Error fetching AI settings:', error);
        setSettings(DEFAULT_AI_SETTINGS);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0 && settings.greeting) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: settings.greeting,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, settings.greeting, messages.length]);

  const sendMessage = useCallback(async (messageContent: string, fileData?: any) => {
    if (!messageContent.trim() && !fileData) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      file: fileData ? { name: fileData.name, analysis: fileData.analysis } : undefined
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    let fullContent = messageContent;
    if (fileData?.analysis) {
      fullContent = `[Plik STL: ${fileData.name}]
Wymiary: ${fileData.analysis.dimensions.width} x ${fileData.analysis.dimensions.depth} x ${fileData.analysis.dimensions.height} mm
Wstępnie szacowany czas druku: ${fileData.analysis.estimatedPrintingTime}h
Wstępnie szacowane zużycie filamentu: ~${fileData.analysis.estimatedFilamentUsage}g
${messageContent}`;
    }

    const assistantMessageId = `assistant_${Date.now()}`;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: buildMessagesPayload(messages, fullContent),
          conversationId,
          sessionId
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'Nie udało się połączyć z asystentem. Spróbuj ponownie za chwilę.');
      }

      setMessages((previous) => [...previous, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let streamBuffer = '';

      if (!reader) {
        assistantMessage = await response.text();
        setMessages((previous) => previous.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: assistantMessage || 'Asystent odpowiedział pustą wiadomością. Spróbuj zadać pytanie jeszcze raz.' }
            : message
        ));
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.content) {
              assistantMessage += data.content;
              setMessages((previous) => previous.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: assistantMessage }
                  : message
              ));
            }

            if (data.conversationId) {
              setConversationId(data.conversationId);
            }

            if (data.error) {
              setMessages((previous) => previous.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `Przepraszam, wystąpił błąd: ${data.error}` }
                  : message
              ));
            }
          } catch {
            // Pojedyncza uszkodzona linia streamu nie powinna psuć całej rozmowy.
          }
        }
      }

      if (!assistantMessage.trim()) {
        setMessages((previous) => previous.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: 'Nie udało mi się odczytać odpowiedzi asystenta. Spróbuj ponownie za chwilę.' }
            : message
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((previous) => [...previous, {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Przepraszam, wystąpił błąd. Spróbuj ponownie.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
      setFileAnalysis(null);
    }
  }, [messages, conversationId, sessionId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (conversationId) {
        formData.append('conversationId', conversationId);
      }

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Nie udało się przeanalizować pliku. Na razie analiza w bocie obsługuje pliki STL.');
      }

      const analysis = await response.json();
      setFileAnalysis({ name: file.name, analysis });
    } catch (error) {
      console.error('File analysis error:', error);
      setMessages((previous) => [...previous, {
        id: `file_error_${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Nie udało się przeanalizować pliku.',
        timestamp: new Date()
      }]);
      setUploadedFile(null);
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (fileAnalysis) {
      sendMessage(input || 'Przeanalizuj wstępnie ten model', fileAnalysis);
    } else {
      sendMessage(input);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const clearConversation = () => {
    setMessages([{
      id: 'greeting',
      role: 'assistant',
      content: settings.greeting || DEFAULT_AI_SETTINGS.greeting,
      timestamp: new Date()
    }]);
    setConversationId(null);
    setShowSuggestions(true);
    setUploadedFile(null);
    setFileAnalysis(null);
  };

  if (settings.enabled === false) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Otwórz asystenta KORIX AI"
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-16 h-16 rounded-full',
          'bg-gradient-to-br from-[#FF6A00] to-orange-600',
          'shadow-lg shadow-orange-500/30',
          'flex items-center justify-center',
          'transition-all duration-300',
          'hover:scale-110 hover:shadow-xl hover:shadow-orange-500/40',
          'group',
          isOpen && 'opacity-0 pointer-events-none'
        )}
      >
        <Bot className="w-7 h-7 text-white transition-transform group-hover:scale-110" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
        <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-20" />
      </button>

      <div
        className={cn(
          'fixed z-50 transition-all duration-500 ease-out',
          'bottom-6 right-6',
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        )}
      >
        <div
          className={cn(
            'w-[420px] max-w-[calc(100vw-48px)]',
            'h-[600px] max-h-[calc(100vh-100px)]',
            'rounded-3xl overflow-hidden',
            'bg-gradient-to-br from-[#1a1a1a]/95 to-[#0a0a0a]/95',
            'backdrop-blur-xl',
            'border border-white/10',
            'shadow-2xl shadow-black/50',
            'flex flex-col'
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-[#FF6A00]/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6A00] to-orange-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1a1a1a]" />
              </div>
              <div>
                <h3 className="font-semibold text-white">KORIX AI</h3>
                <p className="text-xs text-white/50">Bezpłatny asystent druku 3D</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearConversation}
                aria-label="Wyczyść konwersację"
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                title="Wyczyść konwersację"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Zamknij asystenta KORIX AI"
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-[#FF6A00] to-orange-600 text-white'
                      : 'bg-white/5 border border-white/10 text-white/90',
                    message.id === 'greeting' && 'bg-gradient-to-r from-[#FF6A00]/10 to-transparent border border-[#FF6A00]/20'
                  )}
                >
                  {message.file && (
                    <div className="flex items-center gap-2 mb-2 text-xs opacity-70">
                      <FileText className="w-3 h-3" />
                      <span>{message.file.name}</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content || <Loader2 className="w-4 h-4 animate-spin" />}
                  </p>
                  {message.role === 'assistant' && message.content && message.id !== 'greeting' && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                      <button type="button" aria-label="Oceń odpowiedź pozytywnie" className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-green-400">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button type="button" aria-label="Oceń odpowiedź negatywnie" className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-red-400">
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {showSuggestions && messages.length <= 1 && (
              <div className="space-y-2">
                <p className="text-xs text-white/40 text-center">Sugerowane pytania</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => {
                        setShowSuggestions(false);
                        sendMessage(question);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {fileAnalysis && (
            <div className="px-4 pb-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FF6A00]/10 border border-[#FF6A00]/30">
                <FileText className="w-5 h-5 text-[#FF6A00]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{fileAnalysis.name}</p>
                  <p className="text-xs text-white/50">
                    {fileAnalysis.analysis.dimensions.width} x {fileAnalysis.analysis.dimensions.depth} x {fileAnalysis.analysis.dimensions.height} mm
                    {' • '}wstępnie {fileAnalysis.analysis.estimatedFilamentUsage}g filamentu
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setUploadedFile(null); setFileAnalysis(null); }}
                  aria-label="Usuń załączony plik"
                  className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-white/10">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <input
                id="ai-file-upload"
                type="file"
                ref={fileInputRef}
                accept=".stl"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Prześlij plik STL"
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-[#FF6A00] hover:border-[#FF6A00]/30 transition-all"
                title="Prześlij plik STL"
              >
                <Upload className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <textarea
                  aria-label="Wiadomość do asystenta KORIX AI"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={fileAnalysis ? 'Zadaj pytanie o model...' : 'Napisz wiadomość...'}
                  rows={1}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl resize-none',
                    'bg-white/5 border border-white/10',
                    'text-white placeholder:text-white/30',
                    'focus:outline-none focus:border-[#FF6A00]/50 focus:ring-1 focus:ring-[#FF6A00]/20',
                    'transition-all',
                    'max-h-24'
                  )}
                  style={{ minHeight: '48px' }}
                />
              </div>
              <button
                type="submit"
                aria-label={isLoading ? 'Wysyłanie wiadomości' : 'Wyślij wiadomość'}
                disabled={isLoading || (!input.trim() && !fileAnalysis)}
                className={cn(
                  'p-3 rounded-xl transition-all',
                  'bg-gradient-to-br from-[#FF6A00] to-orange-600',
                  'text-white shadow-lg shadow-orange-500/20',
                  'hover:shadow-orange-500/40',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
