-- 031_interview_question_engine_lot_b.sql
-- Sprint 2 Lot B: question packs + debrief forms + default markdown template

CREATE TABLE IF NOT EXISTS public.interview_generated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  interviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (question_type IN ('DURING_INTERVIEW', 'DEBRIEF', 'TEMPLATE')),
  question_text text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_generated_questions_interview
  ON public.interview_generated_questions(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_generated_questions_interviewer
  ON public.interview_generated_questions(interviewer_id);

CREATE INDEX IF NOT EXISTS idx_interview_generated_questions_type
  ON public.interview_generated_questions(question_type);

CREATE TABLE IF NOT EXISTS public.interview_debrief_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  interviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  score_over_10 numeric(4,2) NOT NULL CHECK (score_over_10 >= 0 AND score_over_10 <= 10),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_debrief_answers_interview
  ON public.interview_debrief_answers(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_debrief_answers_interviewer
  ON public.interview_debrief_answers(interviewer_id);

CREATE TABLE IF NOT EXISTS public.interview_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  title text NOT NULL,
  markdown_content text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_question_templates_default
  ON public.interview_question_templates(is_default);

ALTER TABLE public.interview_generated_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_debrief_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_question_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interview_generated_questions' AND policyname = 'HR can manage generated interview questions'
  ) THEN
    CREATE POLICY "HR can manage generated interview questions"
    ON public.interview_generated_questions
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interview_debrief_answers' AND policyname = 'HR can manage interview debrief answers'
  ) THEN
    CREATE POLICY "HR can manage interview debrief answers"
    ON public.interview_debrief_answers
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interview_question_templates' AND policyname = 'Authenticated can read question templates'
  ) THEN
    CREATE POLICY "Authenticated can read question templates"
    ON public.interview_question_templates
    FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;
END $$;

INSERT INTO public.interview_question_templates (template_key, title, markdown_content, is_default)
VALUES (
  'default_interview_template',
  'Default Interview Template',
  '# Interview Template\n\n## During Interview Questions\n- Question 1\n- Question 2\n- Question 3\n\n## Debrief (/10)\n- Communication clarity: /10\n- Ownership and impact: /10\n- Role fit confidence: /10\n\n## Final Note\n- Recommendation and rationale',
  true
)
ON CONFLICT (template_key)
DO UPDATE SET
  title = EXCLUDED.title,
  markdown_content = EXCLUDED.markdown_content,
  is_default = EXCLUDED.is_default;
