-- Adds more motivational badges and expands the badge trigger.
-- Safe to run more than once.

INSERT INTO public.badges (name, description, icon, criteria, points)
VALUES
  (
    'Strong Start',
    'Score 80% or more on any quiz',
    'target',
    '{"type": "score_threshold", "score": 80}',
    60
  ),
  (
    'Elite Performer',
    'Score 90% or more on any quiz',
    'medal',
    '{"type": "score_threshold", "score": 90}',
    100
  ),
  (
    'Flawless Sprint',
    'Score 100% and finish within half the time limit',
    'zap',
    '{"type": "perfect_speed", "time_ratio": 0.5}',
    175
  ),
  (
    'Consistent Performer',
    'Complete 5 quizzes with an average score of at least 80%',
    'trending',
    '{"type": "average_score", "score": 80, "count": 5}',
    150
  ),
  (
    'Reliability Shield',
    'Complete 10 quizzes with an average score of at least 75%',
    'shield',
    '{"type": "average_score", "score": 75, "count": 10}',
    225
  ),
  (
    'Marathon Learner',
    'Complete 50 quizzes',
    'crown',
    '{"type": "tests_completed", "count": 50}',
    500
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  criteria = EXCLUDED.criteria,
  points = EXCLUDED.points;

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
BEGIN
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = NEW.user_id;

  FOR v_badge IN SELECT * FROM public.badges LOOP
    v_should_award := FALSE;

    IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = NEW.user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    IF v_badge.criteria->>'type' = 'perfect_score' THEN
      v_should_award := (NEW.score = 100);
    ELSIF v_badge.criteria->>'type' = 'score_threshold' THEN
      v_should_award := (NEW.score >= (v_badge.criteria->>'score')::INTEGER);
    ELSIF v_badge.criteria->>'type' = 'average_score' THEN
      v_should_award := (
        v_stats.tests_completed >= (v_badge.criteria->>'count')::INTEGER
        AND v_stats.average_score >= (v_badge.criteria->>'score')::INTEGER
      );
    ELSIF v_badge.criteria->>'type' = 'streak' THEN
      v_should_award := (v_stats.current_streak >= (v_badge.criteria->>'count')::INTEGER);
    ELSIF v_badge.criteria->>'type' = 'tests_completed' THEN
      v_should_award := (v_stats.tests_completed >= (v_badge.criteria->>'count')::INTEGER);
    ELSIF v_badge.criteria->>'type' = 'speed' THEN
      v_should_award := (
        NEW.time_taken_seconds IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.quizzes q
          WHERE q.id = NEW.quiz_id
          AND NEW.time_taken_seconds < (q.time_limit_minutes * 60 * 0.5)
        )
      );
    ELSIF v_badge.criteria->>'type' = 'perfect_speed' THEN
      v_should_award := (
        NEW.score = 100
        AND NEW.time_taken_seconds IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.quizzes q
          WHERE q.id = NEW.quiz_id
          AND NEW.time_taken_seconds < (q.time_limit_minutes * 60 * COALESCE((v_badge.criteria->>'time_ratio')::DECIMAL, 0.5))
        )
      );
    ELSIF v_badge.criteria->>'type' = 'first_quiz' THEN
      v_should_award := (v_stats.tests_completed = 1);
    END IF;

    IF v_should_award THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, v_badge.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;

      UPDATE public.user_stats
      SET total_points = total_points + v_badge.points
      WHERE user_id = NEW.user_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
