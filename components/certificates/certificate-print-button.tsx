'use client'

import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'

export function CertificatePrintButton({ certificateId }: { certificateId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button asChild className="rounded-full bg-black text-white hover:bg-zinc-800">
        <a href={`/api/certificates/${certificateId}/download`} download>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()} className="rounded-full bg-white">
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  )
}
