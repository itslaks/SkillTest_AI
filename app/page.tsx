import { redirect } from 'next/navigation'
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { InfrastructureSection } from "@/components/landing/infrastructure-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { SecuritySection } from "@/components/landing/security-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { CTASection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

type SearchParamValue = string | string[] | undefined

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>
}) {
  const params = await searchParams
  const code = firstValue(params.code)
  const tokenHash = firstValue(params.token_hash)
  const type = firstValue(params.type)
  const errorCode = firstValue(params.error_code)
  const errorDescription = firstValue(params.error_description)

  if (code || tokenHash || type === 'recovery' || errorCode || errorDescription) {
    const nextParams = new URLSearchParams()
    if (code) nextParams.set('code', code)
    if (tokenHash) nextParams.set('token_hash', tokenHash)
    if (type) nextParams.set('type', type)
    if (errorCode) nextParams.set('error_code', errorCode)
    if (errorDescription) nextParams.set('error_description', errorDescription)
    redirect(`/auth/update-password${nextParams.toString() ? `?${nextParams.toString()}` : ''}`)
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <InfrastructureSection />
      <MetricsSection />
      <IntegrationsSection />
      <SecuritySection />
      <DevelopersSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <FooterSection />
    </main>
  );
}
