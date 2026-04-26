'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle,
  Send, Bot, User, Loader2, Trash2, Download,
  BarChart3, Users, Trophy, TrendingUp, Sparkles, RefreshCw,
  ChevronRight, Zap, Target, Clock,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'

interface AssessmentRecord {
  Candidate_ID?: string
  Candidate_Full_Name?: string
  Candidate_Email_Address?: string
  Test_Name?: string
  Test_Status?: string
  Test_Score?: number
  Candidate_Score?: number
  Percentage?: number
  Performance_Category?: string
  Total_Questions?: number
  'Test_Duration(minutes)'?: number
  'Time_Taken(minutes)'?: number
  [key: string]: any
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AssessmentAnalyzerProps {
  quizId?: string
  quizTitle?: string
}

const QUICK_QUESTIONS = [
  'Who are the top 5 performers?',
  'What is the average score and pass rate?',
  'Which employees need improvement?',
  'Compare performance by completion time',
]

export function AssessmentAnalyzer({ quizId, quizTitle }: AssessmentAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'analyze' | 'chat'>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stats = calculateStats(records)

  const tabs = [
    { id: 'upload' as const, label: 'Upload Data', icon: Upload, badge: files.length > 0 ? files.length : undefined },
    { id: 'analyze' as const, label: 'Analyze', icon: BarChart3, badge: records.length > 0 ? records.length : undefined },
    { id: 'chat' as const, label: 'AI Chat', icon: Sparkles, badge: chatMessages.length > 0 ? chatMessages.length : undefined },
  ]

  const handleFileSelect = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return
    setFiles(selectedFiles)
    setUploadStatus('processing')
    setUploadProgress(0)
    const allRecords: AssessmentRecord[] = []
    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        const data = await readFile(selectedFiles[i])
        allRecords.push(...data)
        setUploadProgress(((i + 1) / selectedFiles.length) * 60)
      } catch (error: any) {
        setUploadStatus('error')
        setUploadMessage(`Error reading ${selectedFiles[i].name}: ${error.message}`)
        return
      }
    }
    setRecords(allRecords)
    setUploadProgress(80)
    try {
      const response = await fetch('/api/assessment-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, records: allRecords, fileName: selectedFiles.map(f => f.name).join(', ') }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed')
      setUploadProgress(100)
      setUploadStatus('success')
      setUploadMessage(`${result.insertedRecords} records imported successfully`)
      setTimeout(() => setActiveTab('analyze'), 800)
    } catch (error: any) {
      setUploadStatus('error')
      setUploadMessage(error.message || 'Upload failed')
    }
  }

  const readFile = (file: File): Promise<AssessmentRecord[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          resolve(XLSX.utils.sheet_to_json(sheet) as AssessmentRecord[])
        } catch (error) { reject(error) }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsBinaryString(file)
    })
  }

  const handleSendMessage = async (text?: string) => {
    const message = text || chatInput.trim()
    if (!message || isChatLoading) return
    const userMessage: ChatMessage = { role: 'user', content: message, timestamp: new Date() }
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId, quizId, assessmentData: records.length > 0 ? records : undefined }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to get response')
      if (result.sessionId && !sessionId) setSessionId(result.sessionId)
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.message, timestamp: new Date() }])
    } catch (error: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${error.message}`, timestamp: new Date() }])
    } finally {
      setIsChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const clearAll = () => {
    setFiles([])
    setRecords([])
    setUploadStatus('idle')
    setUploadMessage('')
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-sm">
            <BarChart3 className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[15px]">
              Assessment Analyzer
              {quizTitle && <span className="ml-2 text-muted-foreground font-normal text-sm">· {quizTitle}</span>}
            </h3>
            <p className="text-[12px] text-muted-foreground">Upload results, analyze performance, ask AI</p>
          </div>
        </div>
        {records.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full text-xs gap-1.5 px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {records.length} records loaded
            </Badge>
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-muted-foreground hover:text-destructive rounded-lg">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60 bg-muted/10 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all relative -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge !== undefined && (
              <span className={cn(
                'text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none',
                activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* ── UPLOAD TAB ── */}
        {activeTab === 'upload' && (
          <div className="space-y-5">
            {/* Template strip */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/60 border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Need the template format?</p>
                  <p className="text-xs text-blue-600/70">Download our CSV template to get started</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 bg-white" asChild>
                <a href="/templates/assessment-results-template.csv" download>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Template
                </a>
              </Button>
            </div>

            {/* Drop zone */}
            <div
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer group',
                isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : '',
                uploadStatus === 'error' ? 'border-destructive/50 bg-destructive/5' :
                uploadStatus === 'success' ? 'border-emerald-400 bg-emerald-50/50' :
                !isDragging ? 'border-border hover:border-primary/40 hover:bg-muted/30' : ''
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const dropped = Array.from(e.dataTransfer.files).filter(f => /\.(csv|xlsx|xls)$/i.test(f.name))
                if (dropped.length) handleFileSelect(dropped)
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
              />

              {uploadStatus === 'idle' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-colors">
                    <Upload className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-[15px] font-semibold mb-1.5">Drop your files here</h3>
                  <p className="text-sm text-muted-foreground mb-3">or click to browse — supports CSV, Excel (.xlsx, .xls)</p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Multiple files</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Auto-detect columns</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> AI-ready</span>
                  </div>
                </>
              )}

              {uploadStatus === 'processing' && (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Processing your files...</h3>
                    <p className="text-sm text-muted-foreground mb-3">{files.map(f => f.name).join(', ')}</p>
                    <div className="max-w-xs mx-auto space-y-1.5">
                      <Progress value={uploadProgress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{Math.round(uploadProgress)}% complete</p>
                    </div>
                  </div>
                </div>
              )}

              {uploadStatus === 'success' && (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-700 mb-1">Upload successful!</h3>
                    <p className="text-sm text-muted-foreground">{uploadMessage}</p>
                    <p className="text-xs text-emerald-600 mt-1 font-medium">Switching to analysis view…</p>
                  </div>
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
                    <XCircle className="h-7 w-7 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-destructive mb-1">Upload failed</h3>
                    <p className="text-sm text-muted-foreground">{uploadMessage}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); clearAll() }}>
                      Try again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYZE TAB ── */}
        {activeTab === 'analyze' && (
          <div className="space-y-5">
            {records.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-[15px] mb-2">No data to analyze</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload assessment files first to see analytics here</p>
                <Button onClick={() => setActiveTab('upload')} className="rounded-xl gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Files
                </Button>
              </div>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Participants', value: stats.totalParticipants, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Avg Score', value: `${stats.avgScore}%`, icon: Target, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
                    { label: 'Pass Rate', value: `${stats.passRate}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: 'Avg Time', value: `${stats.avgTime}m`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                  ].map((kpi) => (
                    <div key={kpi.label} className={cn('rounded-xl border p-4', kpi.bg, kpi.border)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                        <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                      </div>
                      <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* Pass rate visual */}
                <div className="rounded-xl border border-border/60 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">Pass / Fail Breakdown</h4>
                    <span className="text-xs text-muted-foreground">{records.length} total</span>
                  </div>
                  <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                    <div
                      className="bg-emerald-500 transition-all rounded-l-full"
                      style={{ width: `${stats.passRate}%` }}
                      title={`Passed: ${Math.round(records.length * stats.passRate / 100)}`}
                    />
                    <div
                      className="bg-red-400 flex-1 rounded-r-full"
                      title={`Failed: ${records.length - Math.round(records.length * stats.passRate / 100)}`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Passed ({stats.passRate}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Failed ({100 - stats.passRate}%)</span>
                  </div>
                </div>

                {/* Top performers */}
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Top Performers
                    </h4>
                    <Badge variant="secondary" className="text-xs rounded-full">{stats.topPerformers.length} shown</Badge>
                  </div>
                  <div className="divide-y divide-border/50">
                    {stats.topPerformers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No performer data available</p>
                    ) : stats.topPerformers.map((record, index) => (
                      <div key={index} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-slate-100 text-slate-600' :
                          index === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{record.Candidate_Full_Name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground truncate">{record.Candidate_Email_Address}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold">{record.Percentage}%</span>
                          <Badge
                            variant={record.Performance_Category?.toLowerCase() === 'cleared' ? 'default' : 'secondary'}
                            className="text-xs rounded-full"
                          >
                            {record.Performance_Category || 'N/A'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Button onClick={() => setActiveTab('chat')} variant="outline" className="rounded-xl gap-2 flex-1">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Ask AI About This Data
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Assessment Assistant</p>
                  <p className="text-xs text-muted-foreground">
                    {records.length > 0 ? `Analyzing ${records.length} records` : 'Upload data for deeper analysis'}
                  </p>
                </div>
              </div>
              {chatMessages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setChatMessages([]); setSessionId(null) }} className="h-8 text-muted-foreground hover:text-destructive rounded-lg">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>

            {/* Messages */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <ScrollArea className="h-[380px] p-4">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-violet-500" />
                    </div>
                    <h3 className="font-semibold text-[15px] mb-1">Ask me anything</h3>
                    <p className="text-sm text-muted-foreground mb-5">I can analyze your assessment data and give insights</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                      {QUICK_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => { setActiveTab('chat'); handleSendMessage(q) }}
                          className="text-left text-xs px-3 py-2.5 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-2 group"
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0" />
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <p className="text-[10px] opacity-40 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t border-border/60 p-3 flex gap-2 bg-muted/20">
                <Input
                  placeholder="Ask about performance, trends, scores..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={isChatLoading}
                  className="flex-1 h-9 rounded-xl border-border/60 bg-white text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!chatInput.trim() || isChatLoading}
                  size="icon"
                  className="h-9 w-9 rounded-xl shrink-0"
                >
                  {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function calculateStats(records: AssessmentRecord[]) {
  if (records.length === 0) return { totalParticipants: 0, avgScore: 0, passRate: 0, avgTime: 0, topPerformers: [] }
  const scores = records.map(r => r.Percentage || 0).filter(s => s > 0)
  const times = records.map(r => r['Time_Taken(minutes)'] || 0).filter(t => t > 0)
  const cleared = records.filter(r => r.Performance_Category?.toLowerCase() === 'cleared').length
  const topPerformers = [...records].sort((a, b) => (b.Percentage || 0) - (a.Percentage || 0)).slice(0, 10)
  return {
    totalParticipants: records.length,
    avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    passRate: Math.round((cleared / records.length) * 100),
    avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    topPerformers,
  }
}
