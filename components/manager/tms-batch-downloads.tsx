'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileText, ChevronDown, ChevronRight, Download } from 'lucide-react'

interface Batch {
  id: string
  title: string
  status?: string
}

interface Props {
  batches: Batch[]
}

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  upcoming: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}

export function TmsBatchDownloads({ batches }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Per-Batch Downloads
        </CardTitle>
        <CardDescription>
          Download attendance, assessment, feedback, and topper reports for individual batches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {batches.length === 0 && (
          <p className="text-sm text-zinc-500 py-4 text-center">No batches found.</p>
        )}
        {batches.map((batch) => (
          <div key={batch.id} className="rounded-xl border border-zinc-200 overflow-hidden">
            {/* Batch header row */}
            <button
              onClick={() => toggle(batch.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {expanded[batch.id] ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
                <span className="font-medium text-sm truncate">{batch.title}</span>
                {batch.status && (
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${statusColor[batch.status] ?? 'bg-zinc-100 text-zinc-700'}`}
                  >
                    {batch.status}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-zinc-400 shrink-0 ml-2">Click to expand downloads</span>
            </button>

            {/* Expandable download buttons */}
            {expanded[batch.id] && (
              <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {/* Excel downloads */}
                  <a href={`/api/export/batch-attendance?batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                      Attendance
                    </Button>
                  </a>
                  <a href={`/api/export/batch-assessment?batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                      Assessments
                    </Button>
                  </a>
                  <a href={`/api/export/batch-feedback?batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" />
                      Feedback
                    </Button>
                  </a>
                  <a href={`/api/export/toppers?batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
                      Toppers
                    </Button>
                  </a>
                  <a href={`/api/export/consolidated?batchId=${batch.id}&filter=all`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-600" />
                      Consolidated
                    </Button>
                  </a>

                  {/* PDF downloads */}
                  <a href={`/api/export/pdf?type=attendance&batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                      <FileText className="h-3.5 w-3.5" />
                      Attendance PDF
                    </Button>
                  </a>
                  <a href={`/api/export/pdf?type=toppers&batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                      <FileText className="h-3.5 w-3.5" />
                      Toppers PDF
                    </Button>
                  </a>
                  <a href={`/api/export/pdf?type=feedback&batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                      <FileText className="h-3.5 w-3.5" />
                      Feedback PDF
                    </Button>
                  </a>
                  <a href={`/api/export/pdf?type=consolidated&batchId=${batch.id}`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
                      <FileText className="h-3.5 w-3.5" />
                      Full PDF
                    </Button>
                  </a>
                </div>

                {/* Filter shortcuts */}
                <div className="mt-3 pt-3 border-t border-zinc-200">
                  <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">
                    Consolidated — Filter by status
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['discontinued', 'not_cleared', 'offered', 'onboarded'] as const).map((filter) => (
                      <a key={filter} href={`/api/export/consolidated?batchId=${batch.id}&filter=${filter}`} download>
                        <Button variant="ghost" size="sm" className="h-7 px-3 text-xs text-zinc-600 hover:text-zinc-900">
                          {filter === 'not_cleared' ? 'Not Cleared' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Button>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
