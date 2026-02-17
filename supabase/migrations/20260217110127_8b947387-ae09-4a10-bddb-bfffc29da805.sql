
CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  v_total_users bigint;
  v_dau_today bigint;
  v_active_subs bigint;
  v_total_checkins bigint;
  v_new_users_today bigint;
  v_daily_breakdown jsonb;
BEGIN
  -- Check admin role
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO v_total_users FROM user_settings;
  
  SELECT COUNT(DISTINCT user_id) INTO v_dau_today 
  FROM user_check_ins 
  WHERE logged_at::date = CURRENT_DATE;

  SELECT COUNT(*) INTO v_active_subs 
  FROM user_subscriptions 
  WHERE status = 'active';

  SELECT COUNT(*) INTO v_total_checkins FROM user_check_ins;

  SELECT COUNT(DISTINCT user_id) INTO v_new_users_today 
  FROM user_settings 
  WHERE created_at::date = CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
  INTO v_daily_breakdown
  FROM (
    SELECT 
      logged_at::date as day,
      COUNT(DISTINCT user_id) as dau,
      COUNT(*) as checkins
    FROM user_check_ins
    WHERE logged_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY logged_at::date
    ORDER BY logged_at::date
  ) d;

  result := jsonb_build_object(
    'total_users', v_total_users,
    'dau_today', v_dau_today,
    'active_subscriptions', v_active_subs,
    'total_checkins', v_total_checkins,
    'new_users_today', v_new_users_today,
    'daily_breakdown', v_daily_breakdown
  );

  RETURN result;
END;
$$;
