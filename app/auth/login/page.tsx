'use client'

import { Suspense, useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel, FieldMessage } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { signIn, signInWithMagicLink } from '@/lib/actions/auth'
import { Mail, Lock, Sparkles } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')

  async function handlePasswordLogin(formData: FormData) {
    setError(null)
    if (redirectTo) {
      formData.append('redirect', redirectTo)
    }
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  async function handleMagicLink(formData: FormData) {
    setError(null)
    if (redirectTo) {
      formData.append('redirect', redirectTo)
    }
    startTransition(async () => {
      const result = await signInWithMagicLink(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setMagicLinkSent(true)
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">SkillTest</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account to continue</p>
        </div>

        <Card>
          <Tabs defaultValue="password" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="password">
              <form action={handlePasswordLogin}>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                      {error}
                    </div>
                  )}
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          name="email"
                          type="text"
                          placeholder="you@company.com"
                          required
                          className="pl-10"
                        />
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          placeholder="Enter your password"
                          required
                          className="pl-10"
                        />
                      </div>
                    </Field>
                  </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? <Spinner className="mr-2" /> : null}
                    Sign In
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="magic-link">
              {magicLinkSent ? (
                <CardContent className="py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="mb-2">Check your email</CardTitle>
                  <CardDescription>
                    We&apos;ve sent you a magic link to sign in. Click the link in your email to continue.
                  </CardDescription>
                  <Button 
                    variant="ghost" 
                    className="mt-4"
                    onClick={() => setMagicLinkSent(false)}
                  >
                    Send another link
                  </Button>
                </CardContent>
              ) : (
                <form action={handleMagicLink}>
                  <CardContent className="space-y-4">
                    {error && (
                      <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                        {error}
                      </div>
                    )}
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="magic-email">Email</FieldLabel>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="magic-email"
                            name="email"
                            type="text"
                            placeholder="you@company.com"
                            required
                            className="pl-10"
                          />
                        </div>
                        <FieldMessage>We&apos;ll send you a magic link to sign in</FieldMessage>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? <Spinner className="mr-2" /> : null}
                      Send Magic Link
                    </Button>
                  </CardFooter>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/auth/sign-up" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
