-- ============================================================
-- 032_harden_badge_awards.sql
-- Makes badges harder to earn and prevents one completed quiz
-- from unlocking dozens of badges at once.
-- Safe to re-run.
-- ============================================================

UPDATE public.badges
SET criteria = jsonb_set(
  jsonb_set(
    criteria,
    '{count}',
    to_jsonb(GREATEST(
      COALESCE((criteria->>'count')::INTEGER, 1),
      COALESCE((criteria->>'level')::INTEGER, 1) * 3,
      2
    ))
  ),
  '{score}',
  to_jsonb(GREATEST(COALESCE((criteria->>'score')::INTEGER, 0), 80))
)
WHERE criteria->>'type' IN ('score_threshold', 'speed', 'perfect_score', 'tests_completed', 'streak');

CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge RECORD;
  v_stats RECORD;
  v_should_award BOOLEAN;
  v_awarded_count INTEGER := 0;
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = NEW.user_id;

  FOR v_badge IN SELECT * FROM public.badges ORDER BY points ASC LOOP
    v_should_award := FALSE;
    IF v_awarded_count >= 3 THEN
      EXIT;
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = NEW.user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    IF v_badge.criteria->>'type' = 'perfect_score' THEN
      v_should_award := (
        NEW.score = 100
        AND COALESCE(v_stats.tests_completed, 0) >= COALESCE((v_badge.criteria->>'count')::INTEGER, 1)
      );
    ELSIF v_badge.criteria->>'type' = 'streak' THEN
      v_should_award := (COALESCE(v_stats.current_streak, 0) >= COALESCE((v_badge.criteria->>'count')::INTEGER, 3));
    ELSIF v_badge.criteria->>'type' = 'tests_completed' THEN
      v_should_award := (COALESCE(v_stats.tests_completed, 0) >= COALESCE((v_badge.criteria->>'count')::INTEGER, 3));
    ELSIF v_badge.criteria->>'type' = 'score_threshold' THEN
      v_should_award := (
        NEW.score >= COALESCE((v_badge.criteria->>'score')::INTEGER, 90)
        AND COALESCE(v_stats.tests_completed, 0) >= COALESCE((v_badge.criteria->>'count')::INTEGER, 3)
      );
    ELSIF v_badge.criteria->>'type' = 'speed' THEN
      v_should_award := (
        NEW.time_taken_seconds IS NOT NULL
        AND NEW.score >= COALESCE((v_badge.criteria->>'score')::INTEGER, 85)
        AND COALESCE(v_stats.tests_completed, 0) >= COALESCE((v_badge.criteria->>'count')::INTEGER, 3)
        AND EXISTS (
          SELECT 1 FROM public.quizzes q
          WHERE q.id = NEW.quiz_id
            AND NEW.time_taken_seconds < (q.time_limit_minutes * 60 * 0.5)
        )
      );
    ELSIF v_badge.criteria->>'type' = 'first_quiz' THEN
      v_should_award := (COALESCE(v_stats.tests_completed, 0) = 1);
    END IF;

    IF v_should_award THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, v_badge.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;

      UPDATE public.user_stats
      SET total_points = total_points + v_badge.points
      WHERE user_id = NEW.user_id;

      v_awarded_count := v_awarded_count + 1;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

SELECT 'Migration 032 complete: badge awards hardened.' AS status;
