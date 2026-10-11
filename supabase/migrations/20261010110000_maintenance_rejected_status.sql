-- Admins reject spam or invalid reports instead of deleting them, so the
-- report stays in history and statistics. Kept in its own migration because
-- a new enum value cannot be used in the transaction that adds it.
alter type public.maintenance_status add value if not exists 'REJECTED' after 'RESOLVED';
