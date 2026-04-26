'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { DifficultyLevel } from '@/lib/types/database'

const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']

const DIFFICULTY_DESCRIPTIONS: Record<DifficultyLevel, string> = {
  easy: 'Basic recall, definitions, simple facts',
  medium: 'Understanding, application of concepts',
  hard: 'Analysis, problem-solving, scenarios',
  advanced: 'Evaluation, synthesis, complex scenarios',
  hardcore: 'Expert-level, edge cases, nuanced problems',
}

interface ContentQuestionGeneratorProps {
  quizId: string
  quizTopic: string
  quizDifficulty: DifficultyLevel
  onQuestionsGenerated?: () => void
}

export function ContentQuestionGenerator({ 
  quizId, 
  quizTopic, 
  quizDifficulty,
  onQuestionsGenerated 
}: ContentQuestionGeneratorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [pastedText, setPastedText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractedContent, setExtractedContent] = useState('')
  const [contentStats, setContentStats] = useState<{ wordCount: number; charCount: number } | null>(null)
  
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(quizDifficulty)
  const [questionCount, setQuestionCount] = useState(10)
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ]
      
      if (!validTypes.includes(file.type) && 
          !file.name.endsWith('.pdf') && 
          !file.name.endsWith('.docx') && 
          !file.name.endsWith('.txt')) {
        setError('Please upload a PDF, DOCX, or TXT file')
        return
      }
      
      setSelectedFile(file)
      setExtractedContent('')
      setContentStats(null)
      setError(null)
    }
  }

  async function handleExtractContent() {
    setError(null)
    setIsExtracting(true)

    try {
      const formData = new FormData()
      
      if (selectedFile) {
        formData.append('file', selectedFile)
      } else if (pastedText.trim()) {
        formData.append('text', pastedText.trim())
      } else {
        setError('Please upload a file or paste text content')
        setIsExtracting(false)
        return
      }

      const response = await fetch('/api/extract-content', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to extract content')
      } else {
        setExtractedContent(result.text)
        setContentStats({ wordCount: result.wordCount, charCount: result.charCount })
        toast({
          title: 'Content Extracted',
          description: `Successfully extracted ${result.wordCount} words from your content.`,
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract content')
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleGenerateQuestions() {
    if (!extractedContent) {
      setError('Please extract content first')
      return
    }

    setError(null)
    setSuccess(null)
    setIsGenerating(true)

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

      if (!response.ok) {
        setError(result.error || 'Failed to generate questions')
      } else {
        setSuccess(`Successfully generated ${result.generated} questions!`)
        toast({
          title: 'Questions Generated! 🎉',
          description: `Created ${result.generated} questions at ${difficulty} difficulty.`,
        })
        
        // Reset form
        setPastedText('')
        setSelectedFile(null)
        setExtractedContent('')
        setContentStats(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        
        onQuestionsGenerated?.()
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Generate Questions from Content
        </CardTitle>
        <CardDescription>
          Upload a PDF/DOCX file, or paste text content to generate quiz questions with AI
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

        {/* Step 1: Content Input */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
            <h3 className="font-semibold">Provide Content</h3>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 mt-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOCX, or TXT (max 10MB)
                  </p>
                </label>
              </div>
              
              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="paste" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="paste-content">Paste your content here</Label>
                <Textarea
                  id="paste-content"
                  placeholder="Paste study material, lecture notes, documentation, or any text content you want to generate questions from..."
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {pastedText.length} characters • {pastedText.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Button 
            onClick={handleExtractContent}
            disabled={isExtracting || (!selectedFile && !pastedText.trim())}
            className="w-full"
          >
            {isExtracting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Extracting Content...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Extract Content
              </>
            )}
          </Button>
        </div>

        {/* Content Preview */}
        {extractedContent && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Content Extracted</span>
              </div>
              {contentStats && (
                <div className="flex gap-2">
                  <Badge variant="secondary">{contentStats.wordCount} words</Badge>
                  <Badge variant="outline">{contentStats.charCount} chars</Badge>
                </div>
              )}
            </div>
            <div className="p-4 bg-muted rounded-lg max-h-40 overflow-y-auto">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                {extractedContent.substring(0, 1000)}
                {extractedContent.length > 1000 && '...'}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Configure Generation */}
        {extractedContent && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
              <h3 className="font-semibold">Configure Questions</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Number of Questions</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Primary Difficulty</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  70% of questions will be at this level
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-2 ${
                      difficulty === d
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {DIFFICULTY_DESCRIPTIONS[difficulty]}
              </p>
            </div>

            <Button 
              onClick={handleGenerateQuestions}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate {questionCount} Questions
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
