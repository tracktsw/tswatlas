

# Grant 1-Year Premium to haroontester@live.co.uk

## Action

Insert a single row into the `user_subscriptions` table for user ID `46c4cbbc-9387-42e9-b1f9-715e73569ad2`:

- **Status**: active
- **Period start**: now
- **Period end**: 1 year from now (February 20, 2027)

## Automatic Expiry

No code changes needed. The existing `check-subscription` backend function already checks `current_period_end > now()`. After February 20, 2027, the user will automatically revert to the free tier and would need to subscribe normally.

## Impact

- Only affects this one user
- No other subscriptions are touched
- No frontend or backend code changes required

