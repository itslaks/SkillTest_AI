"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="relative py-24 lg:py-40 overflow-hidden bg-foreground text-background"
    >
      {/* Background circles */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 rounded-full bg-background/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-background/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 text-center">
        <div 
          className={`max-w-3xl mx-auto transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/10 text-background/70 text-sm font-mono mb-8">
            <Sparkles className="w-4 h-4" />
            Join the future of assessments
          </div>
          
          <h2 className="text-5xl lg:text-7xl font-display tracking-tight mb-8">
            Ready to assess
            <br />
            your team?
          </h2>
          
          <p className="text-xl text-background/60 mb-12 leading-relaxed">
            Empower your HR and L&D teams with AI-powered questions and gamified workflows. 
            Get started with SkillTest today and transform your enterprise knowledge checking.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-background text-foreground hover:bg-background/90 px-8 h-14 text-base rounded-full group"
              asChild
            >
              <Link href="/auth/sign-up">
                Get Started Now
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto h-14 px-8 text-base rounded-full border-background/20 hover:bg-background/10 text-background"
              asChild
            >
              <Link href="/auth/login">Sign in to Dashboard</Link>
            </Button>
          </div>
          
          <p className="mt-8 text-sm text-background/40 font-mono">
            FREE INTERNAL TOOL • NO CREDIT CARD REQUIRED
          </p>
        </div>
      </div>
    </section>
  );
}
