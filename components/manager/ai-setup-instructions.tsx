import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, ExternalLink, Key, Zap } from 'lucide-react'
import Link from 'next/link'

export function AISetupInstructions() {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="h-5 w-5" />
          AI Question Generation Setup Required
        </CardTitle>
        <CardDescription className="text-amber-700">
          To enable AI-powered question generation, you need to configure API keys
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">
              <Key className="h-3 w-3 mr-1" />
              Option 1: OpenAI (Recommended)
            </Badge>
          </div>
          <p className="text-sm text-amber-700">
            Get your API key from OpenAI Platform and add it to your <code>.env.local</code> file:
          </p>
          <div className="bg-amber-100 p-3 rounded-md font-mono text-sm">
            OPENAI_API_KEY=your-api-key-here
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Get OpenAI API Key
            </Link>
          </Button>
        </div>

        <div className="border-t border-amber-200 pt-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white">
              <Zap className="h-3 w-3 mr-1" />
              Option 2: Google Gemini
            </Badge>
          </div>
          <p className="text-sm text-amber-700 mt-2">
            Alternatively, use Google Gemini API:
          </p>
          <div className="bg-amber-100 p-3 rounded-md font-mono text-sm mt-2">
            GOOGLE_GEMINI_API_KEY=your-gemini-key-here
          </div>
          <Button variant="outline" size="sm" asChild className="mt-2">
            <Link href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Get Gemini API Key
            </Link>
          </Button>
        </div>

        <div className="bg-white p-3 rounded-md border border-amber-200">
          <p className="text-xs text-amber-600">
            <strong>Note:</strong> Without API keys configured, the system will fall back to template-based question generation, 
            which provides basic questions but may not be as relevant or varied as AI-generated content.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
