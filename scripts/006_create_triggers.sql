-- Trigger: Auto-create user_stats on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_points, current_streak, longest_streak, tests_completed, average_score)
  VALUES (NEW.id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile();

-- Trigger: Update user_stats after quiz completion
CREATE OR REPLACE FUNCTION public.update_user_stats_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tests INTEGER;
  v_total_score DECIMAL;
  v_last_activity DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  -- Only run when status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get current stats
    SELECT 
      tests_completed, 
      current_streak, 
      longest_streak,
      last_activity_date
    INTO v_total_tests, v_current_streak, v_longest_streak, v_last_activity
    FROM public.user_stats
    WHERE user_id = NEW.user_id;
    
    -- Calculate new average
    SELECT AVG(score) INTO v_total_score
    FROM public.quiz_attempts
    WHERE user_id = NEW.user_id AND status = 'completed';
    
    -- Update streak logic
    IF v_last_activity IS NULL OR v_last_activity < CURRENT_DATE - INTERVAL '1 day' THEN
      -- More than 1 day gap, reset streak
      v_current_streak := 1;
    ELSIF v_last_activity = CURRENT_DATE - INTERVAL '1 day' THEN
      -- Consecutive day, increment streak
      v_current_streak := COALESCE(v_current_streak, 0) + 1;
    ELSIF v_last_activity = CURRENT_DATE THEN
      -- Same day, keep streak
      v_current_streak := COALESCE(v_current_streak, 1);
    END IF;
    
    -- Update longest streak if needed
    IF v_current_streak > COALESCE(v_longest_streak, 0) THEN
      v_longest_streak := v_current_streak;
    END IF;
    
    -- Update or insert stats
    INSERT INTO public.user_stats (
      user_id, 
      total_points, 
      current_streak, 
      longest_streak, 
      tests_completed, 
      average_score,
      last_activity_date,
      updated_at
    )
    VALUES (
      NEW.user_id,
      COALESCE(NEW.points_earned, 0),
      v_current_streak,
      v_longest_streak,
      1,
      COALESCE(v_total_score, NEW.score),
      CURRENT_DATE,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_points = public.user_stats.total_points + COALESCE(NEW.points_earned, 0),
      current_streak = v_current_streak,
      longest_streak = GREATEST(public.user_stats.longest_streak, v_longest_streak),
      tests_completed = public.user_stats.tests_completed + 1,
      average_score = v_total_score,
      last_activity_date = CURRENT_DATE,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quiz_attempt_completed ON public.quiz_attempts;
CREATE TRIGGER on_quiz_attempt_completed
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_stats_on_completion();

-- Function to check and award badges
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
  -- Only check when quiz is completed
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Get user stats
  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = NEW.user_id;
  
  -- Check each badge criteria
  FOR v_badge IN SELECT * FROM public.badges LOOP
    v_should_award := FALSE;
    
    -- Check if user already has this badge
    IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = NEW.user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;
    
    -- Check criteria based on type
    IF v_badge.criteria->>'type' = 'perfect_score' THEN
      v_should_award := (NEW.score = 100);
    ELSIF v_badge.criteria->>'type' = 'streak' THEN
      v_should_award := (v_stats.current_streak >= (v_badge.criteria->>'count')::INTEGER);
    ELSIF v_badge.criteria->>'type' = 'tests_completed' THEN
      v_should_award := (v_stats.tests_completed >= (v_badge.criteria->>'count')::INTEGER);
    ELSIF v_badge.criteria->>'type' = 'speed' THEN
      -- Speed demon: complete in less than 50% of time limit
      v_should_award := (
        NEW.time_taken_seconds IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM public.quizzes q 
          WHERE q.id = NEW.quiz_id 
          AND NEW.time_taken_seconds < (q.time_limit_minutes * 60 * 0.5)
        )
      );
    ELSIF v_badge.criteria->>'type' = 'first_quiz' THEN
      v_should_award := (v_stats.tests_completed = 1);
    END IF;
    
    -- Award badge if criteria met
    IF v_should_award THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, v_badge.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Add badge points to user stats
      UPDATE public.user_stats
      SET total_points = total_points + v_badge.points
      WHERE user_id = NEW.user_id;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quiz_completed_check_badges ON public.quiz_attempts;
CREATE TRIGGER on_quiz_completed_check_badges
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_award_badges();

-- Updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS on_quizzes_updated ON public.quizzes;
CREATE TRIGGER on_quizzes_updated
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
