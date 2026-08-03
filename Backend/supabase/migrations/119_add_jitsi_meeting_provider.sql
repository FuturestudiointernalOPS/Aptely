-- Add JITSI to meeting_provider enum
-- Jitsi is used as the default video provider for all remote interviews.
-- Links are auto-generated (meet.jit.si/aptely-{id}), no OAuth required.

ALTER TYPE meeting_provider ADD VALUE IF NOT EXISTS 'JITSI';
