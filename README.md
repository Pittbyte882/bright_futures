# Bright Futures Growing Minds LLC — Website Setup Guide

## What's Included

| File | Purpose |
|------|---------|
| `index.html` | Full landing page (hero, schedule, pricing, sign-up modal) |
| `api/spots.js` | GET endpoint — returns live spot counts from Supabase |
| `api/register.js` | POST endpoint — saves signup, sends emails via Resend |
| `vercel.json` | Vercel routing config |
| `package.json` | Node dependencies |

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the **SQL Editor**, run the following to create your tables:

```sql
-- Table: spot tracking per class day
CREATE TABLE class_spots (
  id           SERIAL PRIMARY KEY,
  class_day    TEXT UNIQUE NOT NULL,  -- 'monday', 'wednesday', 'friday'
  spots_remaining INT NOT NULL DEFAULT 10
);

-- Seed with 10 spots each
INSERT INTO class_spots (class_day, spots_remaining) VALUES
  ('monday', 10),
  ('wednesday', 10),
  ('friday', 10);

-- Table: all registrations
CREATE TABLE registrations (
  id           SERIAL PRIMARY KEY,
  parent_first TEXT NOT NULL,
  parent_last  TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  child_first  TEXT NOT NULL,
  child_age    INT NOT NULL,
  class_day    TEXT NOT NULL,
  package      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Function: atomically decrement a spot (prevents overbooking)
-- Returns new spots_remaining, or -1 if already full
CREATE OR REPLACE FUNCTION decrement_spot(day TEXT)
RETURNS INT AS $$
DECLARE
  current_spots INT;
BEGIN
  SELECT spots_remaining INTO current_spots
  FROM class_spots
  WHERE class_day = day
  FOR UPDATE;

  IF current_spots <= 0 THEN
    RETURN -1;
  END IF;

  UPDATE class_spots
  SET spots_remaining = spots_remaining - 1
  WHERE class_day = day;

  RETURN current_spots - 1;
END;
$$ LANGUAGE plpgsql;
```

3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not anon!) → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Resend Setup

1. Go to [resend.com](https://resend.com) and create an account
2. Add and verify your sending domain (or use Resend's shared domain for testing)
3. Create an API key → `RESEND_API_KEY`
4. Update the `from:` address in `api/register.js` to match your verified domain

---

## Step 3 — Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Add the following **Environment Variables** in Vercel's project settings:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `RESEND_API_KEY` | Your Resend API key |
| `VENMO_HANDLE` | Your Venmo username, e.g. `@BrightFuturesGrowingMinds` |

4. Click **Deploy** — Vercel handles everything automatically

---

## Step 4 — Connect Your GoDaddy Domain

1. In Vercel: Go to your project → **Settings → Domains** → add your domain
2. Vercel will show you DNS records to add
3. Log into GoDaddy → **DNS Management** → add the records Vercel provides
4. Wait 15–60 minutes for DNS to propagate

---

## Step 5 — Reset Spots Between Sessions

When you want to open enrollment for a new batch of classes, run this SQL in Supabase:

```sql
UPDATE class_spots SET spots_remaining = 10;
```

You can also adjust individual days:
```sql
UPDATE class_spots SET spots_remaining = 8 WHERE class_day = 'monday';
```

---

## How It All Works

1. Parent visits your landing page
2. They click "Reserve a Spot" → fill out the modal form
3. Form POSTs to `/api/register`
4. Supabase atomically decrements the spot (no overbooking possible)
5. Registration is saved to your `registrations` table
6. **Parent receives** a confirmation email with your Venmo handle and amount
7. **You receive** a notification email with all the signup details
8. Spot counts on the page refresh every 60 seconds

---

## Viewing Your Registrations

In Supabase → **Table Editor** → select `registrations` to see all signups in a spreadsheet view. You can also export to CSV.

---

## Questions?

Email: Brightfuturesgrowingmindsllc@gmail.com
