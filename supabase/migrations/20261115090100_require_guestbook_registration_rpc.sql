-- Apply after the authenticated moa-write function has replaced the legacy writer.
revoke insert on public.entries, public.comments from service_role;
