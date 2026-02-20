

# Grant 1-Year Premium to haroontester@live.co.uk

## What needs to happen

The database insert was proposed previously but was never executed. We need to add a single row to the `user_subscriptions` table.

## Database Change

Insert one record for user ID `46c4cbbc-9387-42e9-b1f9-715e73569ad2`:

- **status**: `active`
- **current_period_start**: now
- **current_period_end**: 1 year from now (February 20, 2027)

## Automatic Expiry

No code changes needed. The `check-subscription` backend function already checks `current_period_end > now()`. After the year is up, the user automatically reverts to the free tier.

## Technical Details

A single SQL migration:

```text
INSERT INTO user_subscriptions (user_id, status, current_period_start, current_period_end)
VALUES ('46c4cbbc-9387-42e9-b1f9-715e73569ad2', 'active', now(), now() + interval '1 year');
```

No frontend or backend code changes required. The user will need to refresh/re-login to see the updated premium status.

