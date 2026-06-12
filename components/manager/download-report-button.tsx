'use client'

import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useState } from 'react'

interface DownloadReportButtonProps {
  quizId: string
  quizTitle?: string
  variant?: 'quiz' | 'all'
}

export function DownloadReportButton({ quizId, variant = 'quiz' }: DownloadReportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = (format?: 'txt') => {
    setLoading(true)
    const url = variant === 'all'
      ? '/api/reports/download'
      : `/api/leaderboard/${quizId}/download${format === 'txt' ? '?format=txt' : ''}`
    // Use window.open to force browser to handle the response as a file download
    window.open(url, '_blank')
    setTimeout(() => setLoading(false), 2000)
  }

  if (variant === 'all') {
    return (
      <Button
        onClick={() => handleDownload()}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 shadow-md"
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        {loading ? 'Preparing...' : 'Export All (Excel)'}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleDownload()}
        disabled={loading}
        className="h-8 gap-1.5 border-blue-300 text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        <Download className="h-3.5 w-3.5" />
        {loading ? 'Preparing...' : 'XLSX'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleDownload('txt')}
        disabled={loading}
        className="h-8 gap-1.5 border-blue-300 text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        <FileText className="h-3.5 w-3.5" />
        TXT
      </Button>
    </div>
  )
}
