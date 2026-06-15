-- AI Command Operations Copilot hardening:
-- audit log, server-side pending confirmations, and recurring command schedules.

CREATE TABLE IF NOT EXISTS public.ai_command_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  action_type TEXT,
  action_status TEXT NOT NULL CHECK (action_status IN ('previewed', 'confirmed', 'executed', 'failed', 'cancelled', 'expired')),
  affected_entity_type TEXT,
  affected_entity_ids UUID[] DEFAULT ARRAY[]::UUID[],
  affected_count INTEGER NOT NULL DEFAULT 0,
  result_summary TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_command_audit_logs_user_time
ON public.ai_command_audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_command_audit_logs_status_time
ON public.ai_command_audit_logs(action_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_command_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  original_prompt TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  affected_entity_type TEXT,
  affected_entity_ids UUID[] DEFAULT ARRAY[]::UUID[],
  affected_count INTEGER NOT NULL DEFAULT 0,
  preview_summary TEXT NOT NULL,
  message_preview TEXT,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'executed', 'failed', 'expired')),
  audit_log_id UUID REFERENCES public.ai_command_audit_logs(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_command_pending_actions_user_status
ON public.ai_command_pending_actions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_command_pending_actions_expires
ON public.ai_command_pending_actions(expires_at);

CREATE TABLE IF NOT EXISTS public.ai_command_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  command_text TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  time_of_day TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Calcutta',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_command_schedules_enabled_next
ON public.ai_command_schedules(enabled, next_run_at);

ALTER TABLE public.ai_command_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_command_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_command_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Training staff can read own AI command audit logs" ON public.ai_command_audit_logs;
CREATE POLICY "Training staff can read own AI command audit logs"
ON public.ai_command_audit_logs FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Training staff can read own pending AI actions" ON public.ai_command_pending_actions;
CREATE POLICY "Training staff can read own pending AI actions"
ON public.ai_command_pending_actions FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Training staff can read own AI command schedules" ON public.ai_command_schedules;
CREATE POLICY "Training staff can read own AI command schedules"
ON public.ai_command_schedules FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
