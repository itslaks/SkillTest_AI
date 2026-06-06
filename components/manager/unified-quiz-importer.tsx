'use client'

import { useState, useRef } from 'react'
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
  Type,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  Download
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { bulkCreateQuestions } from '@/lib/actions/quiz'
import type { DifficultyLevel, CreateQuestionInput, ParsedQuestion } from '@/lib/types/database'
import { parseUniversalRowsFile, UNIVERSAL_UPLOAD_ACCEPT, STRUCTURED_UPLOAD_ACCEPT } from '@/lib/file-utils'
import * as XLSX from 'xlsx'

const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']
type QuestionSpreadsheetRow = Record<string, string | number | boolean | null | undefined>

const QUESTION_COLUMNS = {
  question: ['question_text', 'question', 'q', 'prompt', 'questiontext'],
  optionA: ['option_a', 'optiona', 'a', 'choicea', 'answer_a'],
  optionB: ['option_b', 'optionb', 'b', 'choiceb', 'answer_b'],
  optionC: ['option_c', 'optionc', 'c', 'choicec', 'answer_c'],
  optionD: ['option_d', 'optiond', 'd', 'choiced', 'answer_d'],
  correct: ['correct_answer', 'correctanswer', 'answer', 'correct', 'key'],
  difficulty: ['difficulty', 'level'],
  explanation: ['explanation', 'reason', 'rationale'],
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getCell(row: QuestionSpreadsheetRow, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  const key = Object.keys(row).find((candidate) => normalizedAliases.has(normalizeHeader(candidate)))
  const value = key ? row[key] : undefined
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeDifficulty(value: string, fallback: DifficultyLevel): DifficultyLevel {
  const normalized = value.toLowerCase()
  return DIFFICULTIES.includes(normalized as DifficultyLevel) ? normalized as DifficultyLevel : fallback
}

function normalizeCorrectAnswer(rawAnswer: string, options: string[]) {
  const answer = rawAnswer.trim()
  const letter = answer.charAt(0).toUpperCase()
  if (['A', 'B', 'C', 'D'].includes(letter)) return letter

  const answerText = answer.toLowerCase()
  const matchIndex = options.findIndex((option) => option.trim().toLowerCase() === answerText)
  return matchIndex >= 0 ? ['A', 'B', 'C', 'D'][matchIndex] : ''
}

function difficultyBadgeClass(difficulty?: DifficultyLevel) {
  switch (difficulty) {
    case 'easy':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'medium':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'hard':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'advanced':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'hardcore':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-muted bg-muted text-muted-foreground'
  }
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
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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
      
      const fileName = file.name.toLowerCase()
      const isDoc = fileName.endsWith('.pdf') || fileName.endsWith('.docx')
      const isSpreadsheet = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')
      const isJson = fileName.endsWith('.json')
      const isXml = fileName.endsWith('.xml')
      
      if (isDoc) {
        setUseAI(true)
      } else if (isSpreadsheet || isJson || isXml) {
        setUseAI(false)
        parseStructuredFileLocally(file)
      }
    }
  }

  function parseRows(jsonData: QuestionSpreadsheetRow[]) {
    const errors: string[] = []
    const seenQuestions = new Set<string>()
    const questions: ParsedQuestion[] = []

    jsonData.forEach((row, index) => {
      const questionText = getCell(row, QUESTION_COLUMNS.question)
      const optionA = getCell(row, QUESTION_COLUMNS.optionA)
      const optionB = getCell(row, QUESTION_COLUMNS.optionB)
      const optionC = getCell(row, QUESTION_COLUMNS.optionC)
      const optionD = getCell(row, QUESTION_COLUMNS.optionD)
      const options = [optionA, optionB, optionC, optionD]
      const correctAnswer = normalizeCorrectAnswer(getCell(row, QUESTION_COLUMNS.correct), options)
      const duplicateKey = questionText.toLowerCase().replace(/\s+/g, ' ').trim()

      if (!questionText || options.some((option) => !option)) {
        errors.push(`Row ${index + 1}: question and all 4 options are required`)
        return
      }
      if (!correctAnswer) {
        errors.push(`Row ${index + 1}: correct answer must be A, B, C, D, or exact option text`)
        return
      }
      if (seenQuestions.has(duplicateKey)) {
        errors.push(`Row ${index + 1}: duplicate question skipped`)
        return
      }

      seenQuestions.add(duplicateKey)
      questions.push({
        question_text: questionText,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_answer: correctAnswer,
        difficulty: normalizeDifficulty(getCell(row, QUESTION_COLUMNS.difficulty), quizDifficulty),
        explanation: getCell(row, QUESTION_COLUMNS.explanation),
      })
    })

    return { questions, errors }
  }

  async function parseStructuredFileLocally(file: File) {
    try {
      const jsonData = await parseUniversalRowsFile(file) as QuestionSpreadsheetRow[]
      
      if (jsonData.length === 0) {
        setError('The file appears to be empty.')
        return
      }

      const { questions, errors } = parseRows(jsonData)

      if (questions.length === 0) {
        setError(`No valid questions found. Required columns: question_text, option_a, option_b, option_c, option_d, correct_answer. ${errors.slice(0, 3).join('; ')}`)
        return
      }

      setParsedQuestions(questions)
      if (errors.length > 0) {
        setError(`${errors.length} row(s) skipped: ${errors.slice(0, 3).join('; ')}`)
      }
      toast({
        title: 'File Parsed',
        description: `Found ${questions.length} valid questions ready to import.`,
      })
    } catch (err: any) {
      setError('Failed to parse file: ' + (err.message || 'Unknown error'))
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
      return result.text as string
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setIsProcessing(false)
    }
  }

  async function processAIGeneration() {
    const contentForGeneration = extractedContent || await handleExtractContent()
    if (!contentForGeneration) return

    setError(null)
    setSuccess(null)
    setIsProcessing(true)

    try {
      const response = await fetch('/api/generate-from-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: quizId,
          content: contentForGeneration,
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
      processAIGeneration()
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
                accept={useAI ? UNIVERSAL_UPLOAD_ACCEPT : STRUCTURED_UPLOAD_ACCEPT}
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
                {useAI ? 'CSV, XLSX, DOCX, PDF, XML, or JSON content for AI generation' : 'CSV, XLSX, XML, or JSON questions for direct import'}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      Answer {q.correct_answer}
                    </Badge>
                    <Badge variant="outline" className={difficultyBadgeClass(q.difficulty)}>
                      {q.difficulty}
                    </Badge>
                  </div>
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
            !extractedContent ? <><Wand2 className="mr-2 h-4 w-4" /> Extract and Generate {questionCount} Questions</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate {questionCount} Questions</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Import {parsedQuestions.length} Questions</>
          )}
        </Button>
        
      </CardContent>
    </Card>
  )
}
