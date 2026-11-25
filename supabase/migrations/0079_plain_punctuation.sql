-- ===========================================================================
-- Text people read: no long dashes.
--
-- Push notifications and form errors written by the database used "—" and
-- "–" (SOS titles, duty times, the booking form). They read as machine-written
-- next to the rest of the app, which now writes "9:00 AM - 5:00 PM" in lists
-- and "9:00 AM to 5:00 PM" in sentences.
--
-- Each function is re-created from its own live definition with only the
-- visible strings changed, so nothing else about it (security definer,
-- search_path, grants) moves.
-- ===========================================================================

do $$
declare
  fixes constant jsonb := jsonb_build_object(
    'enqueue_sos_push', jsonb_build_array(
      jsonb_build_array('''STILL UNANSWERED — ''', '''STILL UNANSWERED: '''),
      jsonb_build_array(''' — intruder''', ''': intruder'''),
      jsonb_build_array(''' — medical''', ''': medical'''),
      jsonb_build_array(''' — fire''', ''': fire'''),
      jsonb_build_array(''' — assault''', ''': assault''')
    ),
    'shifts_announce', jsonb_build_array(jsonb_build_array(''' – ''', ''' to ''')),
    'shifts_changed', jsonb_build_array(jsonb_build_array(''' – ''', ''' to ''')),
    'assign_replacement', jsonb_build_array(jsonb_build_array('''–''', ''' to ''')),
    'submit_service_request', jsonb_build_array(
      jsonb_build_array('required — this is how', 'required. This is how'),
      jsonb_build_array('instead — someone will pick up', 'instead. Someone will pick up')
    )
  );
  fn record;
  def text;
  pair jsonb;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and fixes ? p.proname
  loop
    def := pg_get_functiondef(fn.oid);
    for pair in select * from jsonb_array_elements(fixes -> fn.proname) loop
      def := replace(def, pair ->> 0, pair ->> 1);
    end loop;
    execute def;
  end loop;
end $$;
