'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function CertificatePrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="rounded-full bg-black text-white hover:bg-zinc-800 print:hidden">
      <Download className="mr-2 h-4 w-4" />
      Print / Download PDF
    </Button>
  )
}
