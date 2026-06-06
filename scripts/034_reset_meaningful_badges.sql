-- Reset earned employee badges and replace the catalog with a useful, smaller badge set.
-- This intentionally keeps quiz attempts, certificates, attendance, and training stats intact.
-- Safe to run more than once.

BEGIN;

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'performance',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'zinc',
  ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'circle',
  ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';

DELETE FROM public.user_badges;
DELETE FROM public.badges;

INSERT INTO public.badges (name, description, icon, criteria, points, category, color, shape, rarity)
VALUES
  ('First Assessment', 'Complete your first quiz.', 'check-circle', '{"type":"first_quiz"}', 25, 'foundation', 'emerald', 'circle', 'common'),
  ('Three Quiz Starter', 'Complete 3 quizzes.', 'list-checks', '{"type":"tests_completed","count":3}', 50, 'consistency', 'blue', 'circle', 'common'),
  ('Ten Quiz Finisher', 'Complete 10 quizzes.', 'clipboard-check', '{"type":"tests_completed","count":10}', 125, 'consistency', 'blue', 'hexagon', 'rare'),
  ('Twenty Five Quiz Pro', 'Complete 25 quizzes.', 'layers', '{"type":"tests_completed","count":25}', 250, 'consistency', 'indigo', 'hexagon', 'epic'),
  ('Fifty Quiz Veteran', 'Complete 50 quizzes.', 'crown', '{"type":"tests_completed","count":50}', 500, 'consistency', 'amber', 'diamond', 'legendary'),

  ('Strong Score', 'Score 80% or more on any quiz.', 'target', '{"type":"score_threshold","score":80}', 60, 'quality', 'emerald', 'circle', 'common'),
  ('High Performer', 'Score 90% or more on any quiz.', 'medal', '{"type":"score_threshold","score":90}', 100, 'quality', 'amber', 'hexagon', 'rare'),
  ('Assessment Expert', 'Score 95% or more on any quiz.', 'award', '{"type":"score_threshold","score":95}', 140, 'quality', 'violet', 'hexagon', 'epic'),
  ('Perfect Finish', 'Score 100% on a quiz.', 'sparkles', '{"type":"perfect_score"}', 175, 'quality', 'yellow', 'diamond', 'epic'),

  ('Reliable Performer', 'Complete 5 quizzes with an average score of at least 75%.', 'shield-check', '{"type":"average_score","score":75,"count":5}', 150, 'quality', 'slate', 'circle', 'rare'),
  ('Project Ready', 'Complete 8 quizzes with an average score of at least 80%.', 'briefcase-business', '{"type":"average_score","score":80,"count":8}', 220, 'readiness', 'cyan', 'hexagon', 'rare'),
  ('Client Ready', 'Complete 12 quizzes with an average score of at least 85%.', 'badge-check', '{"type":"average_score","score":85,"count":12}', 320, 'readiness', 'emerald', 'diamond', 'epic'),
  ('Excellence Track', 'Complete 15 quizzes with an average score of at least 90%.', 'trophy', '{"type":"average_score","score":90,"count":15}', 450, 'readiness', 'amber', 'diamond', 'legendary'),

  ('Fast Learner', 'Finish any timed quiz within half the time limit.', 'zap', '{"type":"speed"}', 90, 'speed', 'orange', 'circle', 'rare'),
  ('Flawless Sprint', 'Score 100% and finish within half the time limit.', 'timer-reset', '{"type":"perfect_speed","time_ratio":0.5}', 220, 'speed', 'rose', 'diamond', 'epic'),
  ('Focused Sprint', 'Score 100% and finish within 40% of the time limit.', 'rocket', '{"type":"perfect_speed","time_ratio":0.4}', 325, 'speed', 'red', 'diamond', 'legendary'),

  ('Three Day Streak', 'Keep a 3-day quiz completion streak.', 'flame', '{"type":"streak","count":3}', 80, 'habit', 'orange', 'circle', 'common'),
  ('Seven Day Streak', 'Keep a 7-day quiz completion streak.', 'flame-kindling', '{"type":"streak","count":7}', 180, 'habit', 'red', 'hexagon', 'rare'),
  ('Fourteen Day Streak', 'Keep a 14-day quiz completion streak.', 'calendar-check', '{"type":"streak","count":14}', 350, 'habit', 'purple', 'diamond', 'epic'),

  ('Domain Builder', 'Complete 6 quizzes with an average score of at least 78%.', 'building-2', '{"type":"average_score","score":78,"count":6}', 175, 'domain', 'teal', 'hexagon', 'rare'),
  ('Domain Specialist', 'Complete 10 quizzes with an average score of at least 88%.', 'graduation-cap', '{"type":"average_score","score":88,"count":10}', 300, 'domain', 'violet', 'diamond', 'epic'),
  ('Training Champion', 'Complete 20 quizzes with an average score of at least 85%.', 'star', '{"type":"average_score","score":85,"count":20}', 425, 'leadership', 'amber', 'diamond', 'legendary')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  criteria = EXCLUDED.criteria,
  points = EXCLUDED.points,
  category = EXCLUDED.category,
  color = EXCLUDED.color,
  shape = EXCLUDED.shape,
  rarity = EXCLUDED.rarity;

COMMIT;

SELECT 'Badge catalog reset complete. Existing employee badge awards were cleared; quiz and training history was preserved.' AS status;
