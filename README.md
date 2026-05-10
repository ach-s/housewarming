# housewarming

Static RSVP page for a housewarming, hosted on GitHub Pages. Responses are stored in Supabase.

## How it works

- Plain HTML/CSS/JS — no build step. GitHub Pages serves the repo root.
- `app.js` reads attendees from Supabase via PostgREST and submits new RSVPs the same way, using the project's anon key. Each submit inserts a new row; the displayed list dedupes by name and keeps the most recent answer per person.
- Runtime config (`supabaseUrl`, `supabaseAnonKey`, `address`) is written to `data/config.json` by the deploy workflow from GitHub Actions secrets. The file is gitignored.

## Supabase setup (one-time)

In the Supabase SQL editor, run:

```sql
create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  answer text not null,
  plus_one boolean not null default false,
  created_at timestamptz not null default now()
);

create index attendees_created_at_idx on public.attendees (created_at desc);

alter table public.attendees enable row level security;

create policy "anon select" on public.attendees
  for select to anon using (true);

create policy "anon insert" on public.attendees
  for insert to anon with check (true);
```

Then in the GitHub repo settings, add these Actions secrets:

- `SUPABASE_URL` — e.g. `https://xxxx.supabase.co`
- `SUPABASE_ANON_KEY` — the project's `anon` public key (safe to ship to the browser)
- `EVENT_ADDRESS` — the address shown on the event card

## Local preview

Create `data/config.json` manually (it's gitignored):

```json
{
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseAnonKey": "ey...",
  "address": "123 Home Street"
}
```

Then serve the repo root with any static server, e.g. `python -m http.server 8000`, and open `http://localhost:8000/`.
