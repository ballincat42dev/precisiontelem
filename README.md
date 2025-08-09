
---

## Google Sign-In (Supabase)
1. In Supabase → **Authentication → Providers → Google** → enable and add your Google OAuth credentials.
2. Set your **Site URL** to your deployed Vercel domain and add `https://<vercel-domain>/auth/callback` as a redirect (Supabase usually handles this automatically).
3. The web app has a **/login** page with a "Continue with Google" button.

## Fly.io (Parser)
1. Install the Fly CLI: `brew install flyctl`
2. `cd parser && fly launch` (or reuse the included `fly.toml` and run `fly apps create iracing-telemetry-parser`)
3. Set secrets:
   ```bash
   fly secrets set SUPABASE_URL=<your supabase url> SUPABASE_SERVICE_ROLE=<service key> \
  SUPABASE_STORAGE_BUCKET_RAW=telemetry-raw SUPABASE_STORAGE_BUCKET_PARSED=telemetry-parsed \
  WEBHOOK_SECRET=<your-secret>
   ```
4. Deploy: `fly deploy`

## Team Seeding
Run `supabase/seed_team.sql` in the SQL editor. Use:
```sql
select next_team_label('<BASE_NAME>'); -- returns '<BASE_NAME> 1' on first call
insert into team(name) values (next_team_label('<BASE_NAME>'));
```
The sequence advances by +3 then rounds **up** to the next odd, so labels go: `1, 5, 9, ...`. If you want "round to nearest odd (forward or back)" instead, I can switch the function to a true nearest-odd rule.

---

## Upload permissions & API guards
- The **/api/upload-url** route checks that the caller is a **member of the team** (via Supabase RLS) before issuing a signed upload URL.
- The **lap fetch** route enforces membership before streaming lap JSON.
- Both routes keep storage access server-side with the Service Role, *after* auth checks.

## Admin screen
Visit **/admin** to:
- Create a new team with the next odd-number label (you choose the base name).
- Add members by email (they must sign in once first) or user ID.
Owner/admin roles are enforced.
