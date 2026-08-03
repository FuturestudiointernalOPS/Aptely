-- 033_interviewer_scores_add_comment.sql
-- Add optional global comment for Lot C interviewer score submission

ALTER TABLE public.interview_interviewer_scores
ADD COLUMN IF NOT EXISTS comment text;
