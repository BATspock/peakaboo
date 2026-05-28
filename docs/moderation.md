# Moderation runbook

How to handle reports and bad actors during the early-access phase.
PeakAboo doesn't have an in-app admin UI yet — at ~100 users, you
moderate via the Supabase dashboard's SQL editor. Bookmark this file.

## TL;DR

1. **See pending reports** → run query #1 below
2. **Look at the reported sighting** → query #2
3. **Decide**: dismiss, delete the sighting, or delete the user
4. **Mark the report resolved** → query #5

The Supabase dashboard SQL editor is at:
https://supabase.com/dashboard/project/zwjhrkzqkrdhwmlutijt/sql/new

## 1. List all pending reports

```sql
select
  r.id              as report_id,
  r.created_at,
  r.reason,
  r.notes           as report_notes,
  reporter.display_name as reporter_name,
  s.id              as sighting_id,
  s.user_id         as sighter_user_id,
  sighter.display_name as sighter_name,
  s.observed_at,
  s.notes           as sighting_notes,
  s.visible,
  s.conditions
from public.reports r
join public.sightings s on s.id = r.sighting_id
join public.profiles reporter on reporter.id = r.reporter_user_id
join public.profiles sighter on sighter.id = s.user_id
where r.status = 'pending'
order by r.created_at desc;
```

## 2. View a specific sighting in detail (with photos)

Replace `<SIGHTING_ID>` with the `sighting_id` from query #1.

```sql
select
  s.*,
  p.display_name,
  p.avatar_url,
  array_agg(si.storage_path) filter (where si.id is not null) as photo_paths
from public.sightings s
join public.profiles p on p.id = s.user_id
left join public.sighting_images si on si.sighting_id = s.id
where s.id = '<SIGHTING_ID>'
group by s.id, p.display_name, p.avatar_url;
```

To view a photo, paste this into the address bar (replace path):
```
https://zwjhrkzqkrdhwmlutijt.supabase.co/storage/v1/object/public/sightings/<photo_paths-element>
```

## 3. View a user's full activity before deciding what to do

Replace `<USER_ID>` with the offending user's UUID.

```sql
select 'sighting' as kind, id::text, observed_at as ts, notes as content
from public.sightings where user_id = '<USER_ID>'
union all
select 'viewpoint', id::text, created_at, name
from public.viewpoints where created_by = '<USER_ID>'
union all
select 'rating', viewpoint_id::text, updated_at, review
from public.viewpoint_ratings where user_id = '<USER_ID>'
order by ts desc;
```

## 4. Take action

### Dismiss the report (it's not actually objectionable)

```sql
update public.reports
set status = 'dismissed'
where id = '<REPORT_ID>';
```

### Delete just this one sighting

```sql
-- Photos cascade-delete with the sighting via the FK; storage objects
-- need to be manually cleaned up if you want to free space.
delete from public.sightings where id = '<SIGHTING_ID>';
```

### Delete all of a user's sightings (keep the account)

Use this when someone posted spam but you don't want to ban them.

```sql
delete from public.sightings where user_id = '<USER_ID>';
```

### Delete all of a user's content (sightings, viewpoints they authored,
ratings) but keep the auth account

```sql
-- Run in a transaction so it's atomic
begin;
delete from public.sightings        where user_id = '<USER_ID>';
delete from public.viewpoint_ratings where user_id = '<USER_ID>';
-- Viewpoints the user created — these are public landmarks, you may
-- want to leave them and just NULL the created_by. Only delete if the
-- viewpoints themselves are spammy.
update public.viewpoints set created_by = null where created_by = '<USER_ID>';
-- Or, if the viewpoints ARE spam:
-- delete from public.viewpoints where created_by = '<USER_ID>';
delete from public.viewpoint_favorites where user_id = '<USER_ID>';
commit;
```

### Delete the user entirely

This cascade-deletes their sightings, ratings, favorites, profile, and
auth row. Their reported sightings disappear too.

**Easier path**: Supabase Dashboard → Authentication → Users → find row
→ ⋯ menu → **Delete user**.

**Or via SQL**:
```sql
delete from auth.users where id = '<USER_ID>';
```

(All cascade FKs are set up correctly; we verified this in the security audit.)

## 5. Mark the report resolved (after taking action)

Always do this so the same report doesn't show up again next time you
check.

```sql
update public.reports
set status = 'resolved'
where id = '<REPORT_ID>';
```

If multiple reports were filed against the same sighting/user, resolve
them all at once:

```sql
update public.reports
set status = 'resolved'
where sighting_id = '<SIGHTING_ID>';
```

## 6. Storage cleanup (optional)

Cascade deletes don't remove the photo files in storage. They're cheap
to leave alone — Supabase free tier is 1 GB. If you want to clean up:

Supabase Dashboard → Storage → sightings → find the `<USER_ID>` folder
→ delete it.

## When to escalate beyond manual moderation

If you find yourself running these queries more than once a week, it's
time to:

1. Build an in-app admin UI (a `/admin` route protected by checking the
   user's auth.uid against a hardcoded admin user list)
2. Add automated email warnings via Resend after N reports
3. Add a "block user" feature so reporters never see content from users
   they've blocked

Until then, manual is fine.
