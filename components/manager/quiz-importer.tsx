'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  Download,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { bulkCreateQuestions } from '@/lib/actions/quiz'
import type { DifficultyLevel, CreateQuestionInput } from '@/lib/types/database'
import * as XLSX from 'xlsx'

interface QuizImporterProps {
  quizId: string
  quizDifficulty: DifficultyLevel
  onQuestionsImported?: () => void
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

export function QuizImporter({ 
  quizId, 
  quizDifficulty,
  onQuestionsImported 
}: QuizImporterProps) {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isPending, startTransition] = useTransition()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ]
      
      if (!validTypes.includes(file.type) && 
          !file.name.endsWith('.xlsx') && 
          !file.name.endsWith('.xls') &&
          !file.name.endsWith('.csv')) {
        setError('Please upload an Excel (.xlsx, .xls) or CSV file')
        return
      }
      
      setSelectedFile(file)
      setParsedQuestions([])
      setError(null)
      setSuccess(null)
      parseFile(file)
    }
  }

  async function parseFile(file: File) {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]
      
      if (jsonData.length === 0) {
        setError('The file appears to be empty')
        return
      }

      // Map to expected format - handle various column name formats
      const questions: ParsedQuestion[] = jsonData.map((row) => {
        const q: ParsedQuestion = {
          question_text: row['question_text'] || row['Question'] || row['question'] || row['Q'] || '',
          option_a: row['option_a'] || row['Option A'] || row['A'] || row['a'] || '',
          option_b: row['option_b'] || row['Option B'] || row['B'] || row['b'] || '',
          option_c: row['option_c'] || row['Option C'] || row['C'] || row['c'] || '',
          option_d: row['option_d'] || row['Option D'] || row['D'] || row['d'] || '',
          correct_answer: (row['correct_answer'] || row['Correct Answer'] || row['Answer'] || row['correct'] || 'A').toString().toUpperCase(),
          difficulty: row['difficulty'] || row['Difficulty'] || quizDifficulty,
          explanation: row['explanation'] || row['Explanation'] || '',
        }
        return q
      }).filter(q => q.question_text && q.option_a && q.option_b)

      if (questions.length === 0) {
        setError('No valid questions found. Ensure columns include: question_text, option_a, option_b, option_c, option_d, correct_answer')
        return
      }

      setParsedQuestions(questions)
      toast({
        title: 'File Parsed',
        description: `Found ${questions.length} questions ready to import.`,
      })
    } catch (err: any) {
      setError('Failed to parse file: ' + (err.message || 'Unknown error'))
    }
  }

  async function handleImport() {
    if (parsedQuestions.length === 0) return

    setError(null)
    setSuccess(null)

    const questionsToCreate: CreateQuestionInput[] = parsedQuestions.map((q, i) => {
      const correctLetter = q.correct_answer.charAt(0).toUpperCase()
      const options = [
        { text: q.option_a, isCorrect: correctLetter === 'A' },
        { text: q.option_b, isCorrect: correctLetter === 'B' },
        { text: q.option_c, isCorrect: correctLetter === 'C' },
        { text: q.option_d, isCorrect: correctLetter === 'D' },
      ]

      return {
        quiz_id: quizId,
        question_text: q.question_text,
        options,
        difficulty: q.difficulty || quizDifficulty,
        explanation: q.explanation || undefined,
        status: 'approved' as const,
        order_index: i,
      }
    })

    startTransition(async () => {
      const result = await bulkCreateQuestions(questionsToCreate)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(`Successfully imported ${questionsToCreate.length} questions!`)
        toast({
          title: 'Import Complete',
          description: `${questionsToCreate.length} questions have been added to the quiz.`,
        })
        setParsedQuestions([])
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        onQuestionsImported?.()
        router.refresh()
      }
    })
  }

  function downloadTemplate() {
    const template = [
      {
        question_text: 'What is the capital of France?',
        option_a: 'London',
        option_b: 'Paris',
        option_c: 'Berlin',
        option_d: 'Madrid',
        correct_answer: 'B',
        difficulty: 'easy',
        explanation: 'Paris is the capital and largest city of France.',
      },
      {
        question_text: 'Which planet is known as the Red Planet?',
        option_a: 'Venus',
        option_b: 'Jupiter',
        option_c: 'Mars',
        option_d: 'Saturn',
        correct_answer: 'C',
        difficulty: 'easy',
        explanation: 'Mars appears red due to iron oxide on its surface.',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Questions')
    
    // Set column widths
    ws['!cols'] = [
      { wch: 50 }, // question_text
      { wch: 20 }, // option_a
      { wch: 20 }, // option_b
      { wch: 20 }, // option_c
      { wch: 20 }, // option_d
      { wch: 15 }, // correct_answer
      { wch: 12 }, // difficulty
      { wch: 40 }, // explanation
    ]

    XLSX.writeFile(wb, 'quiz_questions_template.xlsx')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Import Questions from Excel
        </CardTitle>
        <CardDescription>
          Upload an Excel file with your questions. Download the template to see the required format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Template download */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-medium">Download Template</p>
              <p className="text-sm text-muted-foreground">Get the Excel template with required columns</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>

        {/* File upload */}
        <div 
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm font-medium">
            {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Excel (.xlsx, .xls) or CSV files
          </p>
        </div>

        {/* Parsed questions preview */}
        {parsedQuestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Questions Ready to Import</span>
              </div>
              <Badge variant="secondary">{parsedQuestions.length} questions</Badge>
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {parsedQuestions.slice(0, 5).map((q, i) => (
                <div key={i} className="p-3 border-b last:border-b-0">
                  <p className="text-sm font-medium line-clamp-2">{i + 1}. {q.question_text}</p>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Answer: {q.correct_answer}</span>
                    <span>•</span>
                    <span className="capitalize">{q.difficulty}</span>
                  </div>
                </div>
              ))}
              {parsedQuestions.length > 5 && (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  ... and {parsedQuestions.length - 5} more questions
                </div>
              )}
            </div>

            <Button 
              onClick={handleImport} 
              disabled={isPending} 
              className="w-full"
            >
              {isPending ? <Spinner className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
              Import {parsedQuestions.length} Questions
            </Button>
          </div>
        )}

        {/* Format info */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Required Columns:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li><code>question_text</code> - The question text</li>
                <li><code>option_a, option_b, option_c, option_d</code> - Answer choices</li>
                <li><code>correct_answer</code> - Letter of correct answer (A, B, C, or D)</li>
                <li><code>difficulty</code> - Optional (easy, medium, hard, advanced, hardcore)</li>
                <li><code>explanation</code> - Optional explanation</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
