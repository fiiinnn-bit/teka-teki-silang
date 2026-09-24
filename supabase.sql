-- Clean Up Tables If Exist
DROP TABLE IF EXISTS puzzle_answers CASCADE;
DROP TABLE IF EXISTS puzzle_attempts CASCADE;
DROP TABLE IF EXISTS puzzles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  class_name TEXT NOT NULL,
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Puzzles Table
CREATE TABLE puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert Default Puzzle Master Data
INSERT INTO puzzles (id, title, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'TTS Bahasa Arab Master', 'TTS Bahasa Arab berdasarkan PDF Crossword Labs');

-- 3. Puzzle Attempts Table
CREATE TABLE puzzle_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  puzzle_id UUID REFERENCES puzzles(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  wrong_answers INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Puzzle Answers Table
CREATE TABLE puzzle_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES puzzle_attempts(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_answers ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR PROFILES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- RLS POLICIES FOR PUZZLES
CREATE POLICY "Everyone authenticated can view puzzles" ON puzzles FOR SELECT USING (auth.role() = 'authenticated');

-- RLS POLICIES FOR ATTEMPTS
CREATE POLICY "Students view own attempts" ON puzzle_attempts FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Students insert own attempts" ON puzzle_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students update own attempts" ON puzzle_attempts FOR UPDATE USING (auth.uid() = user_id);

-- RLS POLICIES FOR ANSWERS
CREATE POLICY "Students view own answers" ON puzzle_answers FOR SELECT USING (EXISTS (SELECT 1 FROM puzzle_attempts WHERE id = puzzle_answers.attempt_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))));
CREATE POLICY "Students insert own answers" ON puzzle_answers FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM puzzle_attempts WHERE id = puzzle_answers.attempt_id AND user_id = auth.uid()));

-- RPC FUNCTION: Kunci jawaban terlindungi sepenuhnya di server/database side
CREATE OR REPLACE FUNCTION check_puzzle_answers(
  p_attempt_id UUID,
  p_user_answers JSONB,
  p_duration INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correct INTEGER := 0;
  v_wrong INTEGER := 0;
  v_total INTEGER := 18;
  v_score NUMERIC := 0;
  v_item JSONB;
  v_q_num INTEGER;
  v_dir TEXT;
  v_ans TEXT;
  v_expected TEXT;
  v_is_correct BOOLEAN;
BEGIN
  -- Iterasi jawaban user dari JSONB
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_user_answers)
  LOOP
    v_q_num := (v_item->>'question_number')::INTEGER;
    v_dir := v_item->>'direction';
    v_ans := v_item->>'answer';

    -- Master Answer Key dari PDF
    v_expected := CASE 
      WHEN v_q_num = 4 AND v_dir = 'across' THEN 'الأب'
      WHEN v_q_num = 5 AND v_dir = 'across' THEN 'غرفةالمكتب'
      WHEN v_q_num = 9 AND v_dir = 'across' THEN 'حمام'
      WHEN v_q_num = 11 AND v_dir = 'across' THEN 'غرفةالنوم'
      WHEN v_q_num = 14 AND v_dir = 'across' THEN 'أختيالكبيرة'
      WHEN v_q_num = 16 AND v_dir = 'across' THEN 'أختيالصغيرة'
      WHEN v_q_num = 17 AND v_dir = 'across' THEN 'أب'
      WHEN v_q_num = 18 AND v_dir = 'across' THEN 'ذهب'
      WHEN v_q_num = 1 AND v_dir = 'down' THEN 'بوابة'
      WHEN v_q_num = 2 AND v_dir = 'down' THEN 'غرفةالتعلم'
      WHEN v_q_num = 3 AND v_dir = 'down' THEN 'أنام'
      WHEN v_q_num = 5 AND v_dir = 'down' THEN 'غرفةالجلوس'
      WHEN v_q_num = 6 AND v_dir = 'down' THEN 'الطابق'
      WHEN v_q_num = 7 AND v_dir = 'down' THEN 'شرفة'
      WHEN v_q_num = 8 AND v_dir = 'down' THEN 'السفل'
      WHEN v_q_num = 10 AND v_dir = 'down' THEN 'مطبخ'
      WHEN v_q_num = 12 AND v_dir = 'down' THEN 'أخيالكبير'
      WHEN v_q_num = 13 AND v_dir = 'down' THEN 'ربةالبيت'
      WHEN v_q_num = 14 AND v_dir = 'down' THEN 'أخيالصغير'
      WHEN v_q_num = 15 AND v_dir = 'down' THEN 'غرفةالأكل'
      ELSE ''
    END;

    IF v_ans = v_expected THEN
      v_is_correct := true;
      v_correct := v_correct + 1;
    ELSE
      v_is_correct := false;
      v_wrong := v_wrong + 1;
    END IF;

    INSERT INTO puzzle_answers (attempt_id, question_number, user_answer, is_correct)
    VALUES (p_attempt_id, v_q_num, v_ans, v_is_correct);
  END LOOP;

  v_score := (v_correct::NUMERIC / v_total::NUMERIC) * 100;

  UPDATE puzzle_attempts
  SET score = v_score,
      correct_answers = v_correct,
      wrong_answers = v_wrong,
      duration_seconds = p_duration,
      completed_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'score', v_score,
    'correct', v_correct,
    'wrong', v_wrong
  );
END;
$$;