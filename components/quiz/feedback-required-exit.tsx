'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface FeedbackRequiredExitProps {
  feedbackUrl?: string | null
  backHref: string
}

export function FeedbackRequiredExit({ feedbackUrl, backHref }: FeedbackRequiredExitProps) {
  const [hasClicked, setHasClicked] = useState(false)

  if (!feedbackUrl) {
    return (
      <div className="flex justify-center pt-8">
        <Button variant="outline" asChild size="lg" className="rounded-full px-8">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="border-primary/30 bg-primary/5 overflow-hidden ring-1 ring-primary/20">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Mandatory Feedback</h3>
              <p className="text-muted-foreground">Please complete the feedback form to finish your assessment.</p>
            </div>
          </div>
          <Button 
            asChild 
            size="lg" 
            className="rounded-full px-8 h-14 bg-primary text-primary-foreground font-bold hover:scale-[1.05] transition-transform"
            onClick={() => setHasClicked(true)}
          >
            <a href={feedbackUrl} target="_blank" rel="noopener noreferrer">
              Open Feedback Form
              <ExternalLink className="ml-2 h-5 w-5" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-4">
        {!hasClicked && (
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest animate-pulse">
            Exit disabled until feedback viewed
          </p>
        )}
        <Button 
          variant={hasClicked ? "outline" : "ghost"}
          asChild={hasClicked}
          disabled={!hasClicked}
          size="lg"
          className={`rounded-full px-12 h-14 transition-all duration-500 ${
            hasClicked 
              ? "opacity-100 scale-100" 
              : "opacity-30 scale-95 cursor-not-allowed grayscale"
          }`}
        >
          {hasClicked ? (
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-5 w-5" /> Finish & Exit
            </Link>
          ) : (
            <span>Finish & Exit</span>
          )}
        </Button>
      </div>
    </div>
  )
}
