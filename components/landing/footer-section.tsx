"use client";

import Link from "next/link";
import { Github, Twitter, Linkedin, Sparkles } from "lucide-react";

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
      { name: "Documentation", href: "#" },
      { name: "Manager Guide", href: "#" },
      { name: "Employee FAQ", href: "#" },
      { name: "API Reference", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About Us", href: "#" },
      { name: "Privacy Policy", href: "#" },
      { name: "Terms of Service", href: "#" },
      { name: "Contact", href: "#" },
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
            <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
              <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center transition-transform group-hover:rotate-12">
                <Sparkles className="w-6 h-6 text-background" />
              </div>
              <span className="text-2xl font-bold">SkillTest</span>
            </Link>
            <p className="text-muted-foreground max-w-xs mb-8">
              The gamified employee assessment platform for the modern enterprise.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 border border-foreground/10 hover:border-foreground/30 transition-colors">
                <Twitter className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </a>
              <a href="#" className="p-2 border border-foreground/10 hover:border-foreground/30 transition-colors">
                <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </a>
              <a href="#" className="p-2 border border-foreground/10 hover:border-foreground/30 transition-colors">
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
            © 2025 SkillTest. All rights reserved.
          </p>
          <div className="flex gap-8">
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground font-mono">
              Privacy
            </Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground font-mono">
              Terms
            </Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground font-mono">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
