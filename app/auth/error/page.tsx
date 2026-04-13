import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Whitelist of known error codes to prevent XSS via query params
const KNOWN_ERRORS: Record<string, string> = {
  invalid_request: 'The request was invalid. Please try again.',
  access_denied: 'Access was denied. Please check your permissions.',
  server_error: 'A server error occurred. Please try again later.',
  expired_link: 'The link has expired. Please request a new one.',
  invalid_code: 'The verification code is invalid or has expired.',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams
  // Sanitize: only display known error messages, never raw user input
  const errorCode = params?.error || ''
  const errorMessage = KNOWN_ERRORS[errorCode] || null

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errorMessage ? (
                <p className="text-sm text-muted-foreground">
                  {errorMessage}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An unspecified error occurred. Please try again or contact support.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
