-- ============================================================
-- 030_certificates_badge_expansion.sql
-- Adds admin-managed certificate rules and expands badge catalog
-- to 250+ styled badges across 12+ categories.
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'zinc';
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'rounded';
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';

CREATE TABLE IF NOT EXISTS public.certificate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  min_score INTEGER NOT NULL DEFAULT 70 CHECK (min_score BETWEEN 0 AND 100),
  title TEXT NOT NULL DEFAULT 'Certificate of Achievement',
  certificate_name TEXT DEFAULT 'Course Completion Certificate',
  message TEXT,
  template_image_url TEXT,
  template_accent_color TEXT DEFAULT '#6f5ab8',
  template_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.certificate_rules
  ADD COLUMN IF NOT EXISTS certificate_name TEXT DEFAULT 'Course Completion Certificate',
  ADD COLUMN IF NOT EXISTS template_image_url TEXT,
  ADD COLUMN IF NOT EXISTS template_accent_color TEXT DEFAULT '#6f5ab8',
  ADD COLUMN IF NOT EXISTS template_notes TEXT;

CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.certificate_rules(id) ON DELETE SET NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  score INTEGER NOT NULL,
  issued_by UUID REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, user_id)
);

ALTER TABLE public.certificate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage certificate rules" ON public.certificate_rules;
CREATE POLICY "Admins manage certificate rules" ON public.certificate_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Authenticated users view certificate rules" ON public.certificate_rules;
CREATE POLICY "Authenticated users view certificate rules" ON public.certificate_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users view all certificates" ON public.certificates;
CREATE POLICY "Users view all certificates" ON public.certificates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage certificates" ON public.certificates;
CREATE POLICY "Admins manage certificates" ON public.certificates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

WITH categories AS (
  SELECT * FROM (VALUES
    ('Quick Complete', 'zap', 'cyan', 'pill'),
    ('Perfect Answer', 'target', 'emerald', 'hex'),
    ('Daily Attender', 'calendar-check', 'blue', 'rounded'),
    ('Consistency', 'flame', 'orange', 'diamond'),
    ('Accuracy', 'crosshair', 'violet', 'circle'),
    ('Speed', 'timer', 'rose', 'pill'),
    ('Leadership', 'crown', 'amber', 'shield'),
    ('Collaboration', 'users', 'teal', 'rounded'),
    ('Assessment Mastery', 'medal', 'indigo', 'hex'),
    ('Domain Specialist', 'sparkles', 'fuchsia', 'diamond'),
    ('Resilience', 'shield', 'slate', 'shield'),
    ('Knowledge Growth', 'book-open', 'lime', 'circle'),
    ('Project Excellence', 'briefcase', 'sky', 'hex')
  ) AS c(category, icon, color, shape)
),
levels AS (
  SELECT generate_series(1, 20) AS level
),
generated_badges AS (
  SELECT
    c.category || ' ' || l.level AS name,
    'Level ' || l.level || ' achievement for ' || c.category || '.' AS description,
    c.icon,
    jsonb_build_object(
      'type',
      CASE
        WHEN c.category = 'Quick Complete' THEN 'speed'
        WHEN c.category = 'Perfect Answer' THEN 'perfect_score'
        WHEN c.category = 'Daily Attender' THEN 'attendance_rate'
        WHEN c.category = 'Consistency' THEN 'streak'
        WHEN c.category = 'Accuracy' THEN 'score_threshold'
        WHEN c.category = 'Assessment Mastery' THEN 'tests_completed'
        ELSE 'score_threshold'
      END,
      'level', l.level,
      'score', LEAST(100, 78 + l.level),
      'count', GREATEST(2, l.level * 3),
      'attendance', LEAST(100, 82 + l.level)
    ) AS criteria,
    20 + (l.level * 5) AS points,
    c.category,
    c.color,
    c.shape,
    CASE WHEN l.level >= 18 THEN 'legendary' WHEN l.level >= 12 THEN 'epic' WHEN l.level >= 6 THEN 'rare' ELSE 'common' END AS rarity
  FROM categories c CROSS JOIN levels l
)
INSERT INTO public.badges (name, description, icon, criteria, points, category, color, shape, rarity)
SELECT name, description, icon, criteria, points, category, color, shape, rarity
FROM generated_badges
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  criteria = EXCLUDED.criteria,
  points = EXCLUDED.points,
  category = EXCLUDED.category,
  color = EXCLUDED.color,
  shape = EXCLUDED.shape,
  rarity = EXCLUDED.rarity;

CREATE OR REPLACE FUNCTION public.issue_certificate_if_eligible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rule
  FROM public.certificate_rules
  WHERE quiz_id = NEW.quiz_id
    AND enabled = TRUE
    AND NEW.score >= min_score
  LIMIT 1;

  IF v_rule.id IS NOT NULL THEN
    INSERT INTO public.certificates (rule_id, quiz_id, user_id, attempt_id, title, message, score, issued_by)
    VALUES (v_rule.id, NEW.quiz_id, NEW.user_id, NEW.id, v_rule.title, v_rule.message, NEW.score, v_rule.created_by)
    ON CONFLICT (quiz_id, user_id) DO UPDATE SET
      attempt_id = EXCLUDED.attempt_id,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      score = EXCLUDED.score,
      issued_by = EXCLUDED.issued_by,
      issued_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quiz_completed_issue_certificate ON public.quiz_attempts;
CREATE TRIGGER on_quiz_completed_issue_certificate
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.issue_certificate_if_eligible();

CREATE INDEX IF NOT EXISTS idx_certificate_rules_quiz_id ON public.certificate_rules(quiz_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);

SELECT 'Migration 030 complete: certificates enabled and 250+ styled badges seeded.' AS status;
