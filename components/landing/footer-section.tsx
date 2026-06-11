"use client";

import Link from "next/link";
import { Github, Twitter, Linkedin } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

const footerLinks = [
  {
    title: "Platform",
    links: [
      { name: "Features", href: "#features" },
      { name: "How it works", href: "#how-it-works" },
      { name: "Gamification", href: "#gamification" },
      { name: "Security", href: "#security" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Managers", href: "#managers" },
      { name: "Highlights", href: "#highlights" },
      { name: "Sign in", href: "/auth/login" },
      { name: "Create account", href: "/auth/sign-up" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About SkillTest_AI", href: "#why-skilltest-ai" },
      { name: "Security", href: "#security" },
      { name: "Terms", href: "/auth/sign-up" },
      { name: "Contact", href: "mailto:hello@skilltest.ai" },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="bg-background pt-24 pb-12 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 lg:gap-8 mb-24">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center mb-6 group">
              <BrandLogo className="w-52 transition-transform group-hover:scale-[1.02]" imageClassName="aspect-[1100/360]" />
            </Link>
            <p className="text-muted-foreground max-w-xs mb-8">
              SkillTest_AI: Mavericks Execution Platform for modern training teams.
            </p>
            <div className="flex gap-4">
              <a href="https://twitter.com" aria-label="Open SkillTest_AI on Twitter" className="p-2 border border-foreground/10 hover:border-foreground/30 transition-colors">
                <Twitter className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </a>
              <a href="https://linkedin.com" aria-label="Open SkillTest_AI on LinkedIn" className="p-2 border border-foreground/10 hover:border-foreground/30 transition-colors">
                <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </a>
              <a href="https://github.com" aria-label="Open SkillTest_AI on GitHub" className="p-2 border border-foreground/10 hover:border-foreground/30 transition-colors">
                <Github className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </a>
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((column) => (
            <div key={column.title} className="col-span-1">
              <h4 className="font-display text-sm uppercase tracking-widest text-foreground font-bold mb-6">
                {column.title}
              </h4>
              <ul className="space-y-4">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-12 border-t border-foreground/10 gap-8">
          <p className="text-muted-foreground text-sm font-mono">
            (c) 2026 SkillTest_AI. All rights reserved.
          </p>
          <div className="flex gap-8">
            <Link href="#security" className="text-xs text-muted-foreground hover:text-foreground font-mono">
              Privacy
            </Link>
            <Link href="/auth/sign-up" className="text-xs text-muted-foreground hover:text-foreground font-mono">
              Terms
            </Link>
            <Link href="#highlights" className="text-xs text-muted-foreground hover:text-foreground font-mono">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
