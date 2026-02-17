
# Admin Dashboard Tab

## Overview
Add a new "Dashboard" tab as the first tab in the existing Admin page that displays key metrics about the app's usage across all platforms.

## Metrics to Display
- **Total registered users** - count of distinct users from `user_settings` (all users create settings on signup)
- **Daily Active Users (7-day chart)** - unique users with check-ins per day
- **Check-ins per day (7-day chart)** - total check-ins per day
- **Active subscriptions** - count from `user_subscriptions` where status is active
- **Total check-ins (all time)** - overall count
- **New users today** - users who created settings today

## UI Design
- Four summary metric cards at the top (Total Users, DAU Today, Active Subscribers, Total Check-ins)
- A 7-day bar chart below showing DAU and check-in counts per day using Recharts (already installed)
- Consistent styling with the existing admin page

## Technical Details

### Changes to `src/pages/AdminPage.tsx`
1. Add a new "Dashboard" `TabsTrigger` as the first tab, expanding the grid to 5 columns
2. Add a new `TabsContent` for "dashboard" containing:
   - Four `useQuery` hooks to fetch metrics via direct Supabase queries:
     - `SELECT COUNT(DISTINCT user_id) FROM user_settings` for total users
     - `SELECT COUNT(DISTINCT user_id), COUNT(*) FROM user_check_ins WHERE logged_at >= NOW() - INTERVAL '7 days' GROUP BY DATE(logged_at)` for the 7-day DAU/check-in chart
     - `SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active'` for active subs
     - `SELECT COUNT(*) FROM user_check_ins` for total check-ins
   - Since these are admin-only queries and RLS restricts access to own data, we will need a **database function** (`get_admin_metrics`) with `SECURITY DEFINER` that checks the caller is an admin before returning aggregated counts
3. Use Recharts `BarChart` for the 7-day activity chart (already a project dependency)
4. Use the existing `Card` components for metric cards

### New Database Function (migration)
Create a `get_admin_metrics` function that:
- Validates the caller has the admin role using `has_role(auth.uid(), 'admin')`
- Returns a JSON object with: total_users, dau_today, active_subscriptions, total_checkins, and a 7-day daily breakdown array
- Uses `SECURITY DEFINER` to bypass RLS for aggregated counts

### No New Files Needed
All changes will be contained within `AdminPage.tsx` and one database migration for the metrics function.
