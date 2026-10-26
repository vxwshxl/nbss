-- Bookings: an optional end date from the client, and a contract in months or years
-- (sent as months). The end date is the client's, else the last day of the days or
-- months asked for. A new argument changes the signature, so the old one is dropped
-- first rather than left as an overload that named calls would find ambiguous.

drop function if exists submit_service_request(text, text, text, text, text, text, text, text,
  double precision, double precision, integer, boolean, text, date, integer, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.submit_service_request(p_service_type text, p_contact_name text, p_phone text, p_email text DEFAULT NULL::text, p_organisation text DEFAULT NULL::text, p_site_type text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_guards_required integer DEFAULT NULL::integer, p_armed boolean DEFAULT false, p_shift_pattern text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_duration_months integer DEFAULT NULL::integer, p_notes text DEFAULT NULL::text, p_source text DEFAULT 'app'::text, p_days_required integer DEFAULT NULL::integer, p_shift_types text[] DEFAULT NULL::text[], p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me    uuid := auth.uid();
  v_ref   text := next_service_reference();
  v_id    uuid;
  v_open  integer;
  v_types text[];
  v_email text;
begin
  if v_me is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  if coalesce(trim(p_service_type), '') = '' then
    raise exception 'Which service is this for?' using errcode = '22023';
  end if;
  if coalesce(trim(p_contact_name), '') = '' then
    raise exception 'A contact name is required.' using errcode = '22023';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'A phone number is required — this is how the deployment desk replies.'
      using errcode = '22023';
  end if;
  if p_end_date is not null and p_start_date is not null and p_end_date < p_start_date then
    raise exception 'The end date is before the start date.' using errcode = '22023';
  end if;
  if p_duration_months is not null and p_duration_months not between 1 and 600 then
    raise exception 'A contract runs from 1 month to 50 years.' using errcode = '22023';
  end if;
  if p_days_required is not null and p_days_required not between 1 and 3650 then
    raise exception 'Number of days must be between 1 and 3650.' using errcode = '22023';
  end if;

  v_types := array(select distinct t from unnest(coalesce(p_shift_types, '{}')) t
                   where t in ('morning', 'evening', 'night', 'full_day'));

  select count(*) into v_open from service_requests
  where client_id = v_me and created_at > now() - interval '1 hour';
  if v_open >= 5 then
    raise exception 'That is five requests in an hour. Ring the deployment desk instead — someone will pick up.'
      using errcode = 'P0001';
  end if;

  insert into service_requests (
    reference, client_id, contact_name, organisation, email, phone,
    service_type, site_type, district, address, lat, lng,
    guards_required, armed, shift_pattern, start_date, duration_months, notes, source,
    days_required, shift_types, end_date
  ) values (
    v_ref, v_me, trim(p_contact_name), nullif(trim(p_organisation), ''),
    nullif(trim(p_email), ''), trim(p_phone),
    trim(p_service_type), nullif(trim(p_site_type), ''), nullif(trim(p_district), ''),
    nullif(trim(p_address), ''), p_lat, p_lng,
    p_guards_required, coalesce(p_armed, false),
    case when p_shift_pattern in ('24x7', 'day', 'night', 'custom') then p_shift_pattern
         when 'full_day' = any (v_types) then '24x7'
         when cardinality(v_types) > 0 then 'custom' end,
    p_start_date, p_duration_months, nullif(trim(p_notes), ''),
    case when p_source in ('web', 'app') then p_source else 'app' end,
    p_days_required, nullif(v_types, '{}'),
    -- The client's own end date, else the last day of the days or months asked for.
    coalesce(
      p_end_date,
      case when p_start_date is not null and p_days_required is not null then p_start_date + (p_days_required - 1) end,
      case when p_start_date is not null and p_duration_months is not null
           then (p_start_date + make_interval(months => p_duration_months) - interval '1 day')::date end
    )
  )
  returning id into v_id;

  select coalesce(nullif(trim(p_email), ''), email) into v_email from profiles where id = v_me;
  perform enqueue_email(v_email, trim(p_contact_name), 'booking',
    'Booking received · ' || v_ref,
    jsonb_build_object('reference', v_ref, 'status', 'new', 'name', trim(p_contact_name),
                       'guards', p_guards_required, 'days', p_days_required,
                       'shifts', to_jsonb(v_types), 'start', p_start_date, 'district', p_district));
  perform enqueue_staff_email('booking_staff', 'New booking ' || v_ref || ' · ' || trim(p_contact_name),
    jsonb_build_object('reference', v_ref, 'name', trim(p_contact_name), 'organisation', p_organisation,
                       'phone', p_phone, 'guards', p_guards_required, 'days', p_days_required,
                       'shifts', to_jsonb(v_types), 'start', p_start_date, 'district', p_district));

  return jsonb_build_object('id', v_id, 'reference', v_ref, 'status', 'new');
end;
$function$;

revoke all on function submit_service_request from public, anon;
grant execute on function submit_service_request to authenticated;
