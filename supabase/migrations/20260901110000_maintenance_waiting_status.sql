alter type public.maintenance_status add value if not exists 'WAITING_FOR_CARETAKER' after 'IN_PROGRESS';
