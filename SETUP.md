# LittleLoop — Production Setup Guide

## What you now have

A fully architected Next.js app with:
- Firebase Auth (email/password, password reset)
- Firestore multi-tenant database (schools as top-level tenants)
- Firebase Storage (child photos, payment proofs)
- 4 role dashboards: Parent, Teacher, Owner, SuperAdmin
- Subdomain-based school routing (pebblestones.littleloop.app)
- POPIA-compliant Firestore security rules
- PWA manifest (installable on phones)

---

## STEP 1 — Create your Firebase project (15 min)

1. Go to https://console.firebase.google.com
2. Click "Add project" → name it `littleloop-prod`
3. Disable Google Analytics (not needed yet) → Create project

### Enable Authentication
- Build → Authentication → Get started
- Sign-in method → Email/Password → Enable → Save

### Enable Firestore
- Build → Firestore Database → Create database
- Start in **production mode** (you'll deploy the rules below)
- Choose region: `europe-west1` (closest to South Africa)

### Enable Storage
- Build → Storage → Get started
- Rules: click "Next" for now (you'll deploy rules below)

### Get your config
- Project Settings (gear icon) → Your apps → Add app → Web
- App nickname: `littleloop-web` → Register app
- Copy the `firebaseConfig` object — you need these 6 values:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`

---

## STEP 2 — Set Vercel environment variables (5 min)

In your Vercel project (`littleloop-creche-v1`) → Settings → Environment Variables:

Add all 7 variables for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_FIREBASE_API_KEY          = your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN      = your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID       = your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET   = your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID           = your_app_id
NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG       = demo
```

---

## STEP 3 — Deploy Firestore and Storage rules (5 min)

Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
firebase login
firebase init
```

Select: Firestore, Storage → use existing project → accept defaults for file names.

Then deploy:
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

---

## STEP 4 — Create your first school (SuperAdmin) (10 min)

### Create the SuperAdmin user in Firebase Auth
1. Firebase Console → Authentication → Users → Add user
2. Email: your email, Password: strong password
3. Copy the UID shown in the table

### Create the SuperAdmin Firestore document
In Firestore → users → Add document:
- Document ID: (the UID you just copied)
- Fields:
  ```
  uid:         string  = your_uid
  email:       string  = your_email
  displayName: string  = Your Name
  role:        string  = superadmin
  schoolId:    null
  createdAt:   string  = 2026-06-25T00:00:00.000Z
  ```

### Create your first school via the Admin dashboard
1. Visit your deployed app → login with your superadmin account
2. Tap "Add school" → fill in:
   - Name: Pebblestones Preschool
   - Slug: pebblestones
   - Email, phone, address
3. Note the school's Firestore document ID

---

## STEP 5 — Add your first school's users (10 min)

For each owner, teacher, or parent:

1. Firebase Auth → Add user → enter their email + temporary password
2. Copy their UID
3. Firestore → users → Add document with their UID as the ID:

**Owner example:**
```
uid:         = their_uid
email:       = owner@pebblestones.co.za
displayName: = Owner Name
role:        = owner
schoolId:    = pebblestones_firestore_doc_id
createdAt:   = 2026-06-25T00:00:00.000Z
```

**Teacher example:**
```
uid:         = their_uid
email:       = teacher@pebblestones.co.za
displayName: = Teacher Name
role:        = teacher
schoolId:    = school_id
branchId:    = branch_id (from school.branches array)
createdAt:   = 2026-06-25T00:00:00.000Z
```

**Parent example:**
```
uid:         = their_uid
email:       = parent@email.com
displayName: = Parent Name
role:        = parent
schoolId:    = school_id
childIds:    = [child_firestore_id]
createdAt:   = 2026-06-25T00:00:00.000Z
```

---

## STEP 6 — Set up custom domains (Vercel) (10 min)

For subdomain-based multi-tenancy, each school gets its own subdomain.

In your Vercel project → Settings → Domains:
1. Add: `*.littleloop.app` (wildcard)
2. Add your root domain: `littleloop.app`

Then register `littleloop.app` (or your preferred domain) via Vercel Domains or any registrar, and point the DNS to Vercel.

Each school's slug (e.g. `pebblestones`) becomes `pebblestones.littleloop.app` automatically.

**For custom school domains** (e.g. `app.pebblestones.co.za`):
- Add the domain in Vercel → Domains
- Set `NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG=pebblestones` as an environment variable scoped to that domain (Vercel supports per-domain env vars via Edge Config or middleware)

---

## STEP 7 — Seed your first class and children (15 min)

In Firestore, create documents manually for the pilot:

**Collection: classes**
```
schoolId:     = school_id
branchId:     = branch_id
name:         = Toddlers 1-2yr
ageGroupMin:  = 1
ageGroupMax:  = 2
capacity:     = 20
teacherIds:   = [teacher_uid_1, teacher_uid_2]
```

**Collection: children** (one per child)
```
schoolId:     = school_id
branchId:     = branch_id
classId:      = class_id
firstName:    = Mila
lastName:     = Smith
dateOfBirth:  = 2024-03-15
parentIds:    = [parent_uid]
photoConsent: = true
enrolledAt:   = 2026-06-25T00:00:00.000Z
```

---

## Architecture at a glance

```
Firestore Collections:
├── schools/          (top-level tenants)
├── users/            (all users across all schools)
├── children/         (per school, per class)
├── classes/          (per school)
├── daily_updates/    (per child, per day)
├── moments/          (photos per child)
├── invoices/         (per parent, per month)
├── tasks/            (per class)
└── messages/         (per parent-child thread)
```

## Pricing model suggestion (per school/month)

| Plan       | Schools  | Children | Price (ZAR) |
|------------|----------|----------|-------------|
| Starter    | 1 branch | Up to 50 | R1,800/mo   |
| Growth     | 3 branches | Up to 200 | R4,500/mo |
| Enterprise | Unlimited | Unlimited | R9,500/mo  |

---

## What to build next (Phase 2)

1. **Invitation system** — owner sends email invite, user sets own password
2. **Push notifications** — Firebase Cloud Messaging for daily update alerts
3. **WhatsApp alerts** — Twilio integration for parents who don't check the app
4. **Bulk invoice generation** — owner clicks "generate May invoices" → auto-creates all
5. **Class photo sharing** — teacher posts to whole class, not just individual children
6. **Pickup authorisation** — parent adds authorised pickup persons with photo
7. **Waitlist** — prospective parents join waitlist from public landing page
