-- Harden direct Supabase access for quiz attempts and certificates.
-- Run after 032_harden_badge_awards.sql.

-- Make sure older databases accept the full role set used by the app.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role IN%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee', 'trainer', 'training_coordinator', 'manager', 'admin'));

-- Quiz attempts contain answer JSON, so do not expose all completed rows directly.
DROP POLICY IF EXISTS "Users can view completed attempts for leaderboard" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Managers can view all attempts" ON public.quiz_attempts;

CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Training staff can view scoped attempts" ON public.quiz_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      WHERE q.id = quiz_attempts.quiz_id
        AND q.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.training_batch_trainers tbt
        ON tbt.batch_id = q.batch_id
      WHERE q.id = quiz_attempts.quiz_id
        AND tbt.trainer_id = auth.uid()
    )
  );

-- Certificates include learner identity and scores, so scope direct reads.
DROP POLICY IF EXISTS "Users view all certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Training staff can view scoped certificates" ON public.certificates;

CREATE POLICY "Users can view their own certificates" ON public.certificates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Training staff can view scoped certificates" ON public.certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      WHERE q.id = certificates.quiz_id
        AND q.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.training_batch_trainers tbt
        ON tbt.batch_id = q.batch_id
      WHERE q.id = certificates.quiz_id
        AND tbt.trainer_id = auth.uid()
    )
  );
