-- Add APPLICATION_RECEIVED to notification_type enum
-- The public apply flow notifies the enterprise's members with this type, but the
-- value was missing from the enum: every insert was rejected (and the error only
-- logged), so HR never received a "new application" notification.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'APPLICATION_RECEIVED';
