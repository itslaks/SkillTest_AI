'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  MessageSquare, Send, Bot, User, Loader2, Trash2, Download,
  BarChart3, Users, Trophy, TrendingUp
} from 'lucide-react'
import * as XLSX from 'xlsx'

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

export function AssessmentAnalyzer({ quizId, quizTitle }: AssessmentAnalyzerProps) {
  const [activeTab, setActiveTab] = useState('upload')
  const [files, setFiles] = useState<File[]>([])
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Statistics
  const stats = calculateStats(records)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    setFiles(selectedFiles)
    setUploadStatus('processing')
    setUploadProgress(0)

    const allRecords: AssessmentRecord[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      try {
        const data = await readFile(file)
        allRecords.push(...data)
        setUploadProgress(((i + 1) / selectedFiles.length) * 50)
      } catch (error: any) {
        console.error('Error reading file:', file.name, error)
        setUploadStatus('error')
        setUploadMessage(`Error reading ${file.name}: ${error.message}`)
        return
      }
    }

    setRecords(allRecords)
    setUploadProgress(75)

    // Upload to backend
    try {
      const response = await fetch('/api/assessment-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          records: allRecords,
          fileName: selectedFiles.map(f => f.name).join(', '),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setUploadProgress(100)
      setUploadStatus('success')
      setUploadMessage(`Successfully imported ${result.insertedRecords} records`)
      setActiveTab('analyze')
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
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(sheet) as AssessmentRecord[]
          resolve(jsonData)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsBinaryString(file)
    })
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          quizId,
          assessmentData: records.length > 0 ? records : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get response')
      }

      if (result.sessionId && !sessionId) {
        setSessionId(result.sessionId)
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
      }

      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const clearChat = () => {
    setChatMessages([])
    setSessionId(null)
  }

  const clearData = () => {
    setFiles([])
    setRecords([])
    setUploadStatus('idle')
    setUploadMessage('')
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Assessment Data Analyzer
        </CardTitle>
        <CardDescription>
          Upload assessment CSV/Excel files to analyze results and ask AI-powered questions
          {quizTitle && <span className="ml-2 text-primary font-medium">• {quizTitle}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upload" className="flex items-center gap-1">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="analyze" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Analyze
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              AI Chat
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4">
            {/* Template Download */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Need a template? Download the sample format</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/templates/assessment-results-template.csv" download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </a>
              </Button>
            </div>

            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-primary hover:bg-primary/5 ${
                uploadStatus === 'error' ? 'border-destructive' : 
                uploadStatus === 'success' ? 'border-green-500' : 'border-muted'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              
              {uploadStatus === 'idle' && (
                <>
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Upload Assessment Files</h3>
                  <p className="text-muted-foreground mb-4">
                    Drag and drop or click to select CSV/Excel files
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports multiple files with columns: Candidate_Full_Name, Candidate_Email_Address, Percentage, etc.
                  </p>
                </>
              )}

              {uploadStatus === 'processing' && (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold mb-2">Processing Files...</h3>
                  <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {files.map(f => f.name).join(', ')}
                  </p>
                </>
              )}

              {uploadStatus === 'success' && (
                <>
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-green-600">Upload Complete!</h3>
                  <p className="text-muted-foreground">{uploadMessage}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {records.length} records loaded • Ready for analysis
                  </p>
                </>
              )}

              {uploadStatus === 'error' && (
                <>
                  <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-destructive">Upload Failed</h3>
                  <p className="text-muted-foreground">{uploadMessage}</p>
                </>
              )}
            </div>

            {records.length > 0 && (
              <div className="flex justify-between items-center">
                <Badge variant="secondary" className="text-sm">
                  {records.length} records loaded
                </Badge>
                <Button variant="outline" size="sm" onClick={clearData}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Data
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Analyze Tab */}
          <TabsContent value="analyze" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Participants</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalParticipants}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Avg Score</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.avgScore}%</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">Pass Rate</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.passRate}%</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Avg Time</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.avgTime}m</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Performers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Top 10 Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topPerformers.map((record, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700'
                          : index === 1 ? 'bg-gray-100 text-gray-700'
                          : index === 2 ? 'bg-amber-100 text-amber-700'
                          : 'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{record.Candidate_Full_Name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{record.Candidate_Email_Address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold">{record.Percentage}%</span>
                        <Badge variant={record.Performance_Category?.toLowerCase() === 'cleared' ? 'default' : 'secondary'}>
                          {record.Performance_Category || 'N/A'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActiveTab('chat')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Ask AI About This Data
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Analysis
              </Button>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-medium">AI Assessment Assistant</span>
                {records.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {records.length} records loaded
                  </Badge>
                )}
              </div>
              {chatMessages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearChat}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear Chat
                </Button>
              )}
            </div>

            {/* Chat Messages */}
            <ScrollArea className="h-[400px] rounded-lg border p-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-semibold mb-2">Ask me anything about the data</h3>
                  <div className="space-y-1 text-sm">
                    <p>Try asking:</p>
                    <p className="text-primary cursor-pointer hover:underline" onClick={() => setChatInput('Who are the top 5 performers?')}>
                      "Who are the top 5 performers?"
                    </p>
                    <p className="text-primary cursor-pointer hover:underline" onClick={() => setChatInput('What is the average score and pass rate?')}>
                      "What is the average score and pass rate?"
                    </p>
                    <p className="text-primary cursor-pointer hover:underline" onClick={() => setChatInput('Which employees need improvement?')}>
                      "Which employees need improvement?"
                    </p>
                    <p className="text-primary cursor-pointer hover:underline" onClick={() => setChatInput('Compare the performance by completion time')}>
                      "Compare the performance by completion time"
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Ask about the assessment data..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={isChatLoading}
              />
              <Button onClick={handleSendMessage} disabled={!chatInput.trim() || isChatLoading}>
                {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function calculateStats(records: AssessmentRecord[]) {
  if (records.length === 0) {
    return {
      totalParticipants: 0,
      avgScore: 0,
      passRate: 0,
      avgTime: 0,
      topPerformers: [],
    }
  }

  const scores = records.map(r => r.Percentage || 0).filter(s => s > 0)
  const times = records.map(r => r['Time_Taken(minutes)'] || 0).filter(t => t > 0)
  const cleared = records.filter(r => r.Performance_Category?.toLowerCase() === 'cleared').length

  const topPerformers = [...records]
    .sort((a, b) => (b.Percentage || 0) - (a.Percentage || 0))
    .slice(0, 10)

  return {
    totalParticipants: records.length,
    avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    passRate: Math.round((cleared / records.length) * 100),
    avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    topPerformers,
  }
}
