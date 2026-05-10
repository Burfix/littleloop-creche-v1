# Project Gumpo Repo Notes

Repo cloned from:

`https://github.com/Burfix/projectgumpo`

Local path:

`C:\Users\gmsi\OneDrive\Documents\New project\projectgumpo`

Local dev URL:

`http://localhost:4174`

## Sign-In Blocker

The app uses Supabase auth through:

- `src/lib/supabase/client.ts`
- `src/app/auth/login/LoginClient.tsx`

The deployed app bundle points to:

`https://mjlkzvfdsafafkmwfbbj.supabase.co`

That host currently does not resolve in DNS from this machine. This is why sign-in cannot complete even with valid credentials. The likely fixes are:

1. Check whether the Supabase project is paused, deleted, or renamed.
2. Confirm the correct `NEXT_PUBLIC_SUPABASE_URL` in Vercel.
3. Confirm the matching `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set only on the server side, not exposed publicly.

## Useful Features To Borrow

### Parent App

Source: `src/app/dashboard/parent/page.tsx`

- Auto-refresh every 30 seconds for real-time reassurance.
- Multiple-child selector.
- Child status pill: in care, picked up, not arrived.
- Today highlights: arrival, nap time, meals, incidents.
- Timeline with check-in, check-out, meal, nap, incident, and activity events.
- Photo thumbnails attached to timeline events.
- Message teacher action.

### Teacher App

Source: `src/app/dashboard/teacher/page.tsx`

- Teacher classroom summary.
- Present, absent, meals logged, naps logged, incidents.
- Quick actions: attendance, meal, nap timer, incident report.
- Child list with daily attendance status.

### Admin App

Source: `src/app/dashboard/admin/page.tsx`

- School stats: children, teachers, parents, classrooms.
- Quick actions: add child, invite teacher, create classroom, school settings.
- Management pages for children, teachers, parents, classrooms, reports, settings.

### Photo Upload

Source: `src/components/PhotoUpload.tsx`

- File type validation for JPEG, PNG, WEBP, HEIC.
- 5MB file limit.
- Preview before upload.
- Photo can be linked to child, classroom, activity, or incident.

## Product Direction For Our Creche App

The best pieces to carry into our proposal are:

- A parent timeline, not just a photo gallery.
- A clear “in care now” status.
- Teacher quick actions that reduce admin time.
- Billing and receipts as owner-facing retention tools.
- Photo consent and guardian-only access as trust features.
- QR check-in/out as accountability.

