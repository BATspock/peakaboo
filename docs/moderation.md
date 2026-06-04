# Moderation runbook

How to handle reports and bad actors during the early-access phase.
PeakAboo doesn't have an in-app admin UI yet — at ~100 users, you
moderate via the Supabase dashboard's SQL editor. Bookmark this file.

Reports are polymorphic since spec 03 — they can target sightings,
viewpoints, or subjects. The runbook below has separate sections per
target type because the right action varies.

## TL;DR

1. **See pending reports** → query #1 (lists all targets)
2. **Look at the reported item** → queries #2-#4 depending on target type
3. **Decide**: dismiss, delete the content, or delete the user
4. **Mark the report resolved** → query #6

The Supabase dashboard SQL editor is at:
https://supabase.com/dashboard/project/zwjhrkzqkrdhwmlutijt/sql/new

## 1. List all pending reports

```sql
select
  r.id              as report_id,
  r.created_at,
  r.reason,
  r.notes           as report_notes,
  r.target_type,
  r.target_id,
  reporter.display_name as reporter_name
from public.reports r
join public.profiles reporter on reporter.id = r.reporter_user_id
where r.status = 'pending'
order by r.created_at desc;
```

The `target_type` column tells you which detail query to run next.

## 2. Reported sighting — view detail

```sql
select
  s.*,
  p.display_name,
  array_agg(si.storage_path) filter (where si.id is not null) as photo_paths
from public.sightings s
join public.profiles p on p.id = s.user_id
left join public.sighting_images si on si.sighting_id = s.id
where s.id = '<TARGET_ID>'::uuid
group by s.id, p.display_name;
```

To view a photo, paste this into the address bar:
```
https://zwjhrkzqkrdhwmlutijt.supabase.co/storage/v1/object/public/sightings/<photo_paths-element>
```

## 3. Reported viewpoint — view detail

```sql
select
  v.*,
  s.name as subject_name,
  creator.display_name as created_by_name,
  (select count(*) from public.sightings where viewpoint_id = v.id) as sighting_count
from public.viewpoints v
join public.subjects s on s.id = v.subject_id
left join public.profiles creator on creator.id = v.created_by
where v.id = '<TARGET_ID>'::uuid;
```

## 4. Reported subject — view detail

```sql
select
  s.*,
  creator.display_name as created_by_name,
  (select count(*) from public.viewpoints where subject_id = s.id) as viewpoint_count
from public.subjects s
left join public.profiles creator on creator.id = s.created_by
where s.id = '<TARGET_ID>';
```

(Subject IDs are text slugs like `mt-rainier` or `snoqualmie-falls`, not UUIDs.)

## 5. View a user's full activity before deciding what to do

Replace `<USER_ID>` with the offending user's UUID.

```sql
select 'sighting' as kind, id::text, observed_at as ts, notes as content
from public.sightings where user_id = '<USER_ID>'
union all
select 'viewpoint', id::text, created_at, name
from public.viewpoints where created_by = '<USER_ID>'
union all
select 'subject', id, created_at, name
from public.subjects where created_by = '<USER_ID>'
union all
select 'rating', viewpoint_id::text, updated_at, review
from public.viewpoint_ratings where user_id = '<USER_ID>'
order by ts desc;
```

## 6. Take action

### Dismiss the report (it's not actually objectionable)

```sql
update public.reports set status = 'dismissed' where id = '<REPORT_ID>';
```

### Delete a single sighting

```sql
-- Photos cascade-delete via the FK; storage objects can be cleaned manually if needed.
delete from public.sightings where id = '<TARGET_ID>'::uuid;
```

### Delete a single viewpoint

⚠️ **This cascade-deletes ALL sightings, ratings, favorites, and photos
attached to that viewpoint.** Many users might be affected. Usually you
want option B instead.

**Option A — full delete:**
```sql
delete from public.viewpoints where id = '<TARGET_ID>'::uuid;
```

**Option B — keep the viewpoint, scrub the offending fields** (when the
viewpoint itself is fine but its name/description was vandalized):
```sql
update public.viewpoints
set
  name = 'Removed by moderator',
  description = null,
  created_by = null
where id = '<TARGET_ID>'::uuid;
```

### Delete a single subject

⚠️ **This cascade-deletes ALL viewpoints under it, and all their
sightings/ratings/favorites.** Almost always the wrong move. Prefer
option B unless the subject is truly trash (junk/spam/test data).

**Option A — full delete (rare):**
```sql
delete from public.subjects where id = '<TARGET_ID>';
```

**Option B — scrub the offending fields:**
```sql
update public.subjects
set
  name = 'Removed by moderator',
  description = null,
  created_by = null
where id = '<TARGET_ID>';
```

### Delete all of a user's sightings (keep the account)

Use this when someone posted spam sightings but you don't want to ban them.

```sql
delete from public.sightings where user_id = '<USER_ID>';
```

### Delete all of a user's content (sightings, viewpoints, subjects,
ratings) but keep the auth account

```sql
begin;
delete from public.sightings         where user_id = '<USER_ID>';
delete from public.viewpoint_ratings where user_id = '<USER_ID>';
delete from public.viewpoint_favorites where user_id = '<USER_ID>';

-- Viewpoints: usually scrub rather than delete (others' sightings depend on them).
update public.viewpoints set created_by = null where created_by = '<USER_ID>';
-- Or, if the viewpoints themselves are spam:
-- delete from public.viewpoints where created_by = '<USER_ID>';

-- Subjects: same logic — scrub before deleting.
update public.subjects set created_by = null where created_by = '<USER_ID>';
-- Or, if the subjects are spam:
-- delete from public.subjects where created_by = '<USER_ID>';

commit;
```

### Delete the user entirely

This cascade-deletes their sightings, ratings, favorites, profile, and
auth row. Their reported content disappears with them.

**Easier path**: Supabase Dashboard → Authentication → Users → find row
→ ⋯ menu → **Delete user**.

**Or via SQL:**
```sql
delete from auth.users where id = '<USER_ID>';
```

## 7. Mark the report resolved

Always do this so the same report doesn't show up next time you check.

```sql
update public.reports set status = 'resolved' where id = '<REPORT_ID>';
```

If multiple reports were filed against the same target, resolve them all:

```sql
update public.reports
set status = 'resolved'
where target_type = '<TARGET_TYPE>' and target_id = '<TARGET_ID>';
```

## Storage cleanup (optional)

Cascade deletes don't remove the photo files in storage. They're cheap
to leave alone — Supabase free tier is 1 GB. If you want to clean up:

Supabase Dashboard → Storage → sightings → find the `<USER_ID>` folder
→ delete it.

## TODO: drop the deprecated `sighting_id` column

Migration 0011 added `target_type` + `target_id` and backfilled existing
rows but kept the old `sighting_id` column around as a deprecated alias.
ReportSheet still writes to it for backward compat with this runbook.
Once you've fully transitioned to the polymorphic queries above (and
verified nothing reads sighting_id), drop the column with a follow-up
migration.

## When to escalate beyond manual moderation

If you find yourself running these queries more than once a week:

1. Build an in-app admin UI (`/admin` route protected by checking the
   user's auth.uid against a hardcoded admin user list)
2. Add automated email warnings via Resend after N reports
3. Add a "block user" feature so reporters never see content from users
   they've blocked

Until then, manual is fine.
