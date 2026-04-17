'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Upload, 
  FileText, 
  Wand2, 
  CheckCircle2, 
  XCircle, 
  File,
  Type,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  Download
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { bulkCreateQuestions } from '@/lib/actions/quiz'
import type { DifficultyLevel, CreateQuestionInput } from '@/lib/types/database'
import * as XLSX from 'xlsx'

const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']
const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  easy: 'Basic recall, definitions, simple facts',
  medium: 'Understanding, application of concepts',
  hard: 'Analysis, problem-solving, scenarios',
  advanced: 'Evaluation, synthesis, complex scenarios',
  hardcore: 'Expert-level, edge cases, nuanced problems',
}

interface ParsedQuestion {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  difficulty?: DifficultyLevel
  explanation?: string
}

interface UnifiedQuizImporterProps {
  quizId: string
  quizTopic: string
  quizDifficulty: DifficultyLevel
  onQuestionsAdded?: () => void
}

export function UnifiedQuizImporter({ 
  quizId, 
  quizTopic, 
  quizDifficulty,
  onQuestionsAdded 
}: UnifiedQuizImporterProps) {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isPending, startTransition] = useTransition()
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [inputType, setInputType] = useState<'upload' | 'paste'>('upload')
  const [useAI, setUseAI] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(quizDifficulty)
  const [questionCount, setQuestionCount] = useState(10)
  
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [extractedContent, setExtractedContent] = useState('')
  const [contentStats, setContentStats] = useState<{ wordCount: number; charCount: number } | null>(null)
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setParsedQuestions([])
      setExtractedContent('')
      setContentStats(null)
      setError(null)
      setSuccess(null)
      
      // Auto-check AI for docs, uncheck for spreadsheets
      const isDoc = file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt')
      const isSpreadsheet = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')
      
      if (isDoc) {
        setUseAI(true)
      } else if (isSpreadsheet) {
        setUseAI(false)
        parseSpreadsheetLocally(file)
      }
    }
  }

  async function parseSpreadsheetLocally(file: File) {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]
      
      if (jsonData.length === 0) {
        setError('The spreadsheet appears to be empty.')
        return
      }

      const questions: ParsedQuestion[] = jsonData.map((row) => ({
        question_text: row['question_text'] || row['Question'] || row['question'] || row['Q'] || '',
        option_a: row['option_a'] || row['Option A'] || row['A'] || row['a'] || '',
        option_b: row['option_b'] || row['Option B'] || row['B'] || row['b'] || '',
        option_c: row['option_c'] || row['Option C'] || row['C'] || row['c'] || '',
        option_d: row['option_d'] || row['Option D'] || row['D'] || row['d'] || '',
        correct_answer: (row['correct_answer'] || row['Correct Answer'] || row['Answer'] || row['correct'] || 'A').toString().toUpperCase(),
        difficulty: row['difficulty'] || row['Difficulty'] || quizDifficulty,
        explanation: row['explanation'] || row['Explanation'] || '',
      })).filter(q => q.question_text && q.option_a && q.option_b)

      if (questions.length === 0) {
        setError('No valid questions found. Ensure columns include: question_text, option_a, option_b, option_c, option_d, correct_answer')
        return
      }

      setParsedQuestions(questions)
      toast({
        title: 'Spreadsheet Parsed',
        description: `Found ${questions.length} questions ready to import.`,
      })
    } catch (err: any) {
      setError('Failed to parse spreadsheet: ' + (err.message || 'Unknown error'))
    }
  }

  async function handleExtractContent() {
    setError(null)
    setIsProcessing(true)

    try {
      const formData = new FormData()
      if (inputType === 'upload' && selectedFile) {
        formData.append('file', selectedFile)
      } else if (inputType === 'paste' && pastedText.trim()) {
        formData.append('text', pastedText.trim())
      } else {
        throw new Error('Please provide a file or text content')
      }

      const response = await fetch('/api/extract-content', { method: 'POST', body: formData })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Failed to extract content')

      setExtractedContent(result.text)
      setContentStats({ wordCount: result.wordCount, charCount: result.charCount })
      
      toast({
        title: 'Content Extracted',
        description: `Successfully extracted ${result.wordCount} words. Ready for AI generation.`,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  async function processAIGeneration() {
    if (!extractedContent) {
      await handleExtractContent()
      // Note: In a real flow, you might want to wait for state to update, 
      // but let's just require them to extract first or handle it automatically if content is available.
      // To keep it simple, if extractedContent is empty after handleExtractContent, we return.
      return
    }

    setError(null)
    setSuccess(null)
    setIsProcessing(true)

    try {
      const response = await fetch('/api/generate-from-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: quizId,
          content: extractedContent,
          difficulty,
          count: questionCount,
          topic: quizTopic,
        }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Failed to generate questions')

      setSuccess(`Successfully generated ${result.generated} AI questions!`)
      toast({
        title: 'AI Generation Complete! 🎉',
        description: `Created ${result.generated} questions.`,
      })
      
      resetForm()
      onQuestionsAdded?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  async function processDirectImport() {
    if (parsedQuestions.length === 0) return

    setError(null)
    setSuccess(null)
    setIsProcessing(true)

    const questionsToCreate: CreateQuestionInput[] = parsedQuestions.map((q, i) => {
      const correctLetter = q.correct_answer.charAt(0).toUpperCase()
      return {
        quiz_id: quizId,
        question_text: q.question_text,
        options: [
          { text: q.option_a, isCorrect: correctLetter === 'A' },
          { text: q.option_b, isCorrect: correctLetter === 'B' },
          { text: q.option_c, isCorrect: correctLetter === 'C' },
          { text: q.option_d, isCorrect: correctLetter === 'D' },
        ],
        difficulty: q.difficulty || quizDifficulty,
        explanation: q.explanation || undefined,
        status: 'approved' as const,
        order_index: i,
      }
    })

    const result = await bulkCreateQuestions(questionsToCreate)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`Successfully imported ${questionsToCreate.length} questions!`)
      toast({
        title: 'Import Complete',
        description: `${questionsToCreate.length} questions have been added.`,
      })
      resetForm()
      onQuestionsAdded?.()
    }
    setIsProcessing(false)
  }

  function handleAction() {
    if (useAI) {
      if (!extractedContent) handleExtractContent()
      else processAIGeneration()
    } else {
      processDirectImport()
    }
  }

  function resetForm() {
    setPastedText('')
    setSelectedFile(null)
    setParsedQuestions([])
    setExtractedContent('')
    setContentStats(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function downloadTemplate() {
    const template = [{
      question_text: 'What is the capital of France?', option_a: 'London', option_b: 'Paris', option_c: 'Berlin', option_d: 'Madrid', correct_answer: 'B', difficulty: 'easy', explanation: 'Paris is the capital.'
    }]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Questions')
    XLSX.writeFile(wb, 'quiz_questions_template.xlsx')
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardHeader className="bg-muted/30 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Add Questions
            </CardTitle>
            <CardDescription>
              Upload documents, spreadsheets, or paste text to add questions.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2 bg-background/50 p-2 px-3 rounded-lg border">
            <Checkbox 
              id="ai-mode" 
              checked={useAI} 
              onCheckedChange={(c) => setUseAI(!!c)}
              className="data-[state=checked]:bg-primary"
            />
            <label htmlFor="ai-mode" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              Use AI Generation
            </label>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2 animate-in fade-in zoom-in-95">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-2 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Input Source Tabs */}
        <Tabs value={inputType} onValueChange={(v: any) => setInputType(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Paste Text {useAI ? '' : '(Not available)'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {!useAI && (
               <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border mb-4">
                 <div className="flex items-center gap-3">
                   <FileSpreadsheet className="h-6 w-6 text-green-600" />
                   <div>
                     <p className="text-sm font-medium">Direct Spreadsheet Import</p>
                     <p className="text-xs text-muted-foreground">Download our template to ensure correct formatting</p>
                   </div>
                 </div>
                 <Button variant="outline" size="sm" onClick={downloadTemplate}>
                   <Download className="mr-2 h-4 w-4" /> Template
                 </Button>
               </div>
            )}
            
            <div 
              className="border-2 border-dashed border-border/60 hover:border-primary/50 bg-muted/10 rounded-xl p-8 text-center cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={useAI ? ".pdf,.docx,.txt" : ".xlsx,.xls,.csv"}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex justify-center mb-4">
                {useAI ? <FileText className="h-10 w-10 text-primary/70" /> : <FileSpreadsheet className="h-10 w-10 text-green-600/70" />}
              </div>
              <p className="text-sm font-medium">
                {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {useAI ? 'PDF, DOCX, or TXT documents for AI generation' : 'XLSX, XLS, or CSV spreadsheets for direct import'}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="paste">
            {!useAI ? (
              <div className="p-8 text-center border rounded-lg bg-muted/30">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Pasting text requires AI Generation to be enabled.</p>
                <Button variant="outline" className="mt-4" onClick={() => setUseAI(true)}>Enable AI Generation</Button>
              </div>
            ) : (
              <Textarea
                placeholder="Paste study material, lecture notes, or documentation..."
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="font-mono text-sm resize-none rounded-xl"
              />
            )}
          </TabsContent>
        </Tabs>

        {/* AI Configuration Section */}
        {useAI && extractedContent && (
          <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/10">
               <div className="flex items-center gap-2">
                 <CheckCircle2 className="h-4 w-4 text-primary" />
                 <span className="text-sm font-medium text-primary">Content Ready</span>
               </div>
               <Badge variant="outline" className="text-xs">{contentStats?.wordCount} words extracted</Badge>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Number of Questions</Label>
                <Input
                  type="number" min={1} max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Difficulty Level</Label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                      difficulty === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Spreadsheet Preview Section */}
        {!useAI && parsedQuestions.length > 0 && (
          <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <CheckCircle2 className="h-4 w-4 text-green-600" />
                 <span className="text-sm font-medium">Ready to Import</span>
              </div>
              <Badge variant="secondary">{parsedQuestions.length} questions</Badge>
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-lg bg-muted/10 divide-y">
              {parsedQuestions.slice(0, 3).map((q, i) => (
                <div key={i} className="p-3">
                  <p className="text-sm font-medium line-clamp-1">{i + 1}. {q.question_text}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ans: {q.correct_answer} • {q.difficulty}</p>
                </div>
              ))}
              {parsedQuestions.length > 3 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                  + {parsedQuestions.length - 3} more questions
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button 
          onClick={handleAction}
          disabled={isProcessing || (!useAI && parsedQuestions.length === 0) || (useAI && !selectedFile && !pastedText.trim() && !extractedContent)}
          className="w-full h-12 rounded-xl text-base"
        >
          {isProcessing ? (
            <><Spinner className="mr-2 h-4 w-4" /> Processing...</>
          ) : useAI ? (
            !extractedContent ? <><Wand2 className="mr-2 h-4 w-4" /> Extract Content</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate {questionCount} Questions</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Import {parsedQuestions.length} Questions</>
          )}
        </Button>
        
      </CardContent>
    </Card>
  )
}
