"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, Paperclip } from "lucide-react";

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

interface RuixenMoonChatProps {
  title: string;
  subtitle: string;
  value: string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  quickActions?: ReactNode;
  utilityActions?: ReactNode;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}

export default function RuixenMoonChat({
  title,
  subtitle,
  value,
  placeholder = "Type your request...",
  loading,
  disabled,
  children,
  quickActions,
  utilityActions,
  onChange,
  onSubmit,
  onKeyDown,
}: RuixenMoonChatProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 150,
  });

  return (
    <div className="relative min-h-[calc(100vh-11rem)] overflow-hidden rounded-2xl bg-slate-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-75"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(2, 6, 23, 0.48), rgba(2, 6, 23, 0.94)), url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1800&q=80')",
          backgroundAttachment: "fixed",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.26),transparent_34%),linear-gradient(135deg,rgba(8,47,73,0.74),rgba(15,23,42,0.92))]" />

      <div className="relative flex min-h-[calc(100vh-11rem)] flex-col items-center px-4 py-8">
        <div className="flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="rounded-full border border-sky-200/20 bg-sky-200/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">
            SkillTest_AI Command
          </div>
          {utilityActions}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center py-8">
          <div className="max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow-sm md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-sky-100/80 md:text-base">
              {subtitle}
            </p>
          </div>

          {children ? (
            <div className="chatbot-scrollbar mt-8 max-h-[34vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/45 p-3 backdrop-blur-md">
              {children}
            </div>
          ) : null}
        </div>

        <div className="mb-[8vh] w-full max-w-3xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
              adjustHeight(true);
            }}
            className="relative rounded-2xl border border-sky-200/20 bg-slate-950/70 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-md"
          >
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                adjustHeight();
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className={cn(
                "w-full resize-none border-none px-4 py-3",
                "bg-transparent text-sm text-white",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "placeholder:text-sky-100/45 min-h-[52px]"
              )}
              style={{ overflow: "hidden" }}
            />

            <div className="flex items-center justify-between px-3 pb-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-sky-100/75 hover:bg-sky-200/10 hover:text-white"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                disabled={disabled || loading || !value.trim()}
                className="h-9 rounded-xl bg-sky-300 px-3 text-slate-950 hover:bg-sky-200 disabled:bg-slate-700 disabled:text-slate-400"
              >
                <ArrowUpIcon className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </form>

          {quickActions ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {quickActions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
