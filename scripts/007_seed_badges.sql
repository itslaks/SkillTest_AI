-- Seed default badges
INSERT INTO public.badges (name, description, icon, criteria, points)
VALUES 
  (
    'Quick Learner',
    'Complete your first quiz',
    'rocket',
    '{"type": "first_quiz"}',
    50
  ),
  (
    'Perfect Score',
    'Achieve 100% on any quiz',
    'trophy',
    '{"type": "perfect_score"}',
    100
  ),
  (
    'Speed Demon',
    'Complete a quiz in less than 50% of the time limit',
    'zap',
    '{"type": "speed"}',
    75
  ),
  (
    'Streak Starter',
    'Maintain a 3-day quiz streak',
    'flame',
    '{"type": "streak", "count": 3}',
    50
  ),
  (
    'Streak Master',
    'Maintain a 7-day quiz streak',
    'fire',
    '{"type": "streak", "count": 7}',
    150
  ),
  (
    'Dedicated Learner',
    'Complete 5 quizzes',
    'book-open',
    '{"type": "tests_completed", "count": 5}',
    75
  ),
  (
    'Quiz Champion',
    'Complete 10 quizzes',
    'award',
    '{"type": "tests_completed", "count": 10}',
    150
  ),
  (
    'Knowledge Master',
    'Complete 25 quizzes',
    'crown',
    '{"type": "tests_completed", "count": 25}',
    300
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  criteria = EXCLUDED.criteria,
  points = EXCLUDED.points;
