-- Training operations expansion for the Maverick Execution Platform brief.
-- Adds batch lifecycle, trainer coordination, attendance, reminders, and structured feedback.

CREATE TABLE IF NOT EXISTS training_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'at_risk', 'completed')),
  start_date DATE,
  end_date DATE,
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES training_batches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS batch_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('invited', 'active', 'completed', 'dropped')),
  support_status TEXT NOT NULL DEFAULT 'on_track' CHECK (support_status IN ('on_track', 'needs_support', 'critical')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(batch_id, user_id)
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  agenda TEXT,
  session_date TIMESTAMPTZ NOT NULL,
  mode TEXT NOT NULL DEFAULT 'virtual' CHECK (mode IN ('virtual', 'classroom', 'hybrid')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  attendance_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_time TIMESTAMPTZ,
  notes TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS training_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES training_batches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'batch' CHECK (audience IN ('batch', 'trainers', 'coordinators', 'individual')),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'whatsapp')),
  delivery_status TEXT NOT NULL DEFAULT 'draft' CHECK (delivery_status IN ('draft', 'scheduled', 'sent')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES training_batches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  feedback_text TEXT NOT NULL,
  action_item TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_batches_created_by ON training_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_training_batches_trainer_id ON training_batches(trainer_id);
CREATE INDEX IF NOT EXISTS idx_batch_members_batch_id ON batch_members(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_members_user_id ON batch_members(user_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_batch_id ON training_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_session_date ON training_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_session_attendance_session_id ON session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_training_notifications_batch_id ON training_notifications(batch_id);
CREATE INDEX IF NOT EXISTS idx_training_feedback_batch_id ON training_feedback(batch_id);

CREATE OR REPLACE FUNCTION update_training_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_training_batches_updated_at ON training_batches;
CREATE TRIGGER set_training_batches_updated_at
BEFORE UPDATE ON training_batches
FOR EACH ROW
EXECUTE FUNCTION update_training_updated_at();

DROP TRIGGER IF EXISTS set_training_sessions_updated_at ON training_sessions;
CREATE TRIGGER set_training_sessions_updated_at
BEFORE UPDATE ON training_sessions
FOR EACH ROW
EXECUTE FUNCTION update_training_updated_at();
