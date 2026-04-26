"use client";

import { useState, useEffect, useRef } from "react";
import { FileSpreadsheet, PlusCircle, BarChart, Users } from "lucide-react";

const managerCapabilities = [
  {
    label: "Step 1: Import",
    code: `// Manager uploads Excel
const employeeList = [
  { name: "Amit Sharma", email: "amit.sharma@yourcompany.com", domain: "Tech" },
  { name: "Neha Patel", email: "neha.patel@yourcompany.com", domain: "HR" }
]

// System auto-categorizes by domain`,
  },
  {
    label: "Step 2: Quiz",
    code: `// Define Quiz Parameters
const quizSettings = {
  topic: "React Advanced",
  difficulty: "Hard",
  numQuestions: 20,
  feedbackLink: "https://forms.gle/xyz"
}

// AI generates MCQ questions`,
  },
  {
    label: "Step 3: Analyze",
    code: `// View Dynamic Leaderboard
const leaderboard = getLeaderboard(quizId);

// Export to Excel
exportToExcel(leaderboard);
// (Includes Name, Score, Time, Rank)`,
  },
];

const managerFeatures = [
  { 
    title: "Excel Workflow", 
    description: "Upload employees and download results in seconds."
  },
  { 
    title: "AI Question Bank", 
    description: "Automatically generate high-quality MCQs by topic."
  },
  { 
    title: "Role Management", 
    description: "Full control over employee access and domains."
  },
  { 
    title: "Instant Reports", 
    description: "Real-time analytics and time-based rankings."
  },
];

const codeAnimationStyles = `
  .manager-code-line {
    opacity: 0;
    transform: translateX(-8px);
    animation: managerLineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes managerLineReveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .manager-code-char {
    opacity: 0;
    filter: blur(8px);
    animation: managerCharReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes managerCharReveal {
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
`;

export function DevelopersSection() {
  const [activeTab, setActiveTab] = useState(0);
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
    <section id="managers" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: codeAnimationStyles }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              For Managers
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Complete control.
              <br />
              <span className="text-muted-foreground">Effortless workflow.</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
              SkillTest provides managers with a unified workspace to manage employees, create advanced assessments, and extract actionable insights.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-2 gap-6">
              {managerFeatures.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <h3 className="font-medium mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right: Code/Process block */}
          <div
            className={`lg:sticky lg:top-32 transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10 h-full">
              {/* Tabs */}
              <div className="flex items-center border-b border-foreground/10 bg-foreground/[0.02]">
                {managerCapabilities.map((item, idx) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-6 py-4 text-sm font-mono transition-colors relative ${
                      activeTab === idx
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    {activeTab === idx && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Process content */}
              <div className="p-8 font-mono text-sm bg-foreground/[0.01] min-h-[280px]">
                <pre className="text-foreground/80">
                  {managerCapabilities[activeTab].code.split('\n').map((line, lineIndex) => (
                    <div 
                      key={`${activeTab}-${lineIndex}`} 
                      className="leading-loose manager-code-line"
                      style={{ animationDelay: `${lineIndex * 80}ms` }}
                    >
                      <span className="inline-flex">
                        {line.split('').map((char, charIndex) => (
                          <span
                            key={`${activeTab}-${lineIndex}-${charIndex}`}
                            className="manager-code-char"
                            style={{
                              animationDelay: `${lineIndex * 80 + charIndex * 15}ms`,
                            }}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>

              {/* Action Icons Bar */}
              <div className="px-6 py-4 border-t border-foreground/10 flex items-center justify-around text-muted-foreground">
                 <div className="flex flex-col items-center gap-1">
                   <FileSpreadsheet className="h-5 w-5" />
                   <span className="text-[10px] uppercase font-mono tracking-tighter">Excel</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                   <PlusCircle className="h-5 w-5" />
                   <span className="text-[10px] uppercase font-mono tracking-tighter">Create</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                   <Users className="h-5 w-5" />
                   <span className="text-[10px] uppercase font-mono tracking-tighter">Team</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                   <BarChart className="h-5 w-5" />
                   <span className="text-[10px] uppercase font-mono tracking-tighter">Report</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
