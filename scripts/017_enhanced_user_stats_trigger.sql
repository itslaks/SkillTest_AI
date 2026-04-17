-- Enhanced trigger with better error handling and logging
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
    
    -- Log the trigger execution
    RAISE NOTICE 'User stats trigger fired for user % on quiz %', NEW.user_id, NEW.quiz_id;
    
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
      
    RAISE NOTICE 'User stats updated successfully for user %', NEW.user_id;
    
  END IF;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the quiz completion
  RAISE WARNING 'Error updating user stats for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_quiz_attempt_completed ON public.quiz_attempts;
CREATE TRIGGER on_quiz_attempt_completed
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_stats_on_completion();
