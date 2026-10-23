# Launch checklist

Follow these steps in order. It takes about 45–60 minutes the first time. The PRD requires a **new** Vercel account and a **new** Supabase project, so don't reuse personal or existing ones.

You need **Node.js 20+** and **Git** installed on your computer.

---

## 1. Put the code on GitHub
1. Unzip the project and open a terminal in the `tenfold` folder.
2. Create a new, empty repository on github.com (for example `tenfold`). Don't add a README.
3. Run:
   ```bash
   git remote add origin https://github.com/<you>/tenfold.git
   git branch -M main
   git push -u origin main
   ```
   (The project already has its first commit.)

## 2. Create the Supabase project (database)
1. Sign up at supabase.com with a **new** account and create a **new project**. Choose a region close to your users and save the database password.
2. Go to **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
3. Start a new query, paste `supabase/seed.sql`, and click **Run**. This adds 6 starter charities.
4. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email". Testers can then sign up and pay straight away. If you leave it on, the app shows a "check your inbox" step instead.
5. Go to **Project Settings → API Keys** and copy:
   - the **Project URL** (also under Settings → Data API)
   - the **anon / publishable** key → `VITE_SUPABASE_ANON_KEY`
   - the **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one private)

## 3. Get Stripe test keys
1. Sign up at stripe.com. You don't need to activate the account; **test mode** is enough.
2. Make sure **Test mode** is on, then open **Developers → API keys** and copy the **Secret key** (`sk_test_…`).
   You don't need to create products, because the app sets prices itself (`src/config/plans.js`).

## 4. Deploy on Vercel
1. Sign up at vercel.com with a **new** account and connect your GitHub.
2. **Add New → Project →** import the `tenfold` repo. Vercel detects Vite automatically.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | leave out for now (step 5) |
   | `APP_URL` | add after the first deploy, e.g. `https://tenfold-xyz.vercel.app` |

4. Click **Deploy**. When it finishes, copy your live URL.
5. Add `APP_URL` with that URL, then go to **Deployments → ⋯ → Redeploy**.

## 5. Connect the Stripe webhook
This handles renewals, cancellations and failed payments.
1. In Stripe (test mode), go to **Developers → Webhooks → Add endpoint**.
2. Set the endpoint URL to `https://<your-site>/api/stripe-webhook`.
3. Select these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
4. Copy the **Signing secret** (`whsec_…`), add it in Vercel as `STRIPE_WEBHOOK_SECRET`, and **redeploy**.

## 6. Tell Supabase your site address
In **Authentication → URL Configuration**, set **Site URL** to your Vercel URL and add `https://<your-site>/**` under Redirect URLs.

## 7. Create the test accounts
In the project folder on your computer:
```bash
cp .env.example .env     # then paste VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into it
npm install
npm run seed:demo
```
This creates:
- **Admin:** `admin@tenfold.demo` / `Tenfold!Admin2026`
- **Member:** `player@tenfold.demo` / `Tenfold!Player2026` (active plan, 5 scores)
- 24 demo members with active plans and 5 scores each, so the draw has tickets.

To use different passwords, edit them at the top of `scripts/seed-demo.mjs` before you run it.

## 8. Run your first draw
1. Sign in as the admin, go to **Admin → Draws**, and click **Simulate draw**.
2. Review the numbers and winners, then click **Publish results**.
3. Sign in as a winner to see the win and upload a proof screenshot. Then, as the admin, go to **Winners → Review proof → Approve → Mark paid**.

## 9. Test everything (PRD §16.1)
- [ ] Sign up a brand-new user, pick a charity, and pay with card `4242 4242 4242 4242`. The dashboard should show **Active**.
- [ ] Try both the **monthly** and **yearly** plans (use two different new users).
- [ ] Add 6 scores and confirm only the latest 5 remain, newest first. Try a duplicate date, a score of 46, and a future date. Each should be blocked.
- [ ] Change the charity and percentage on the dashboard.
- [ ] Make a one-off donation from a charity page while signed out.
- [ ] Cancel the membership, then undo the cancellation.
- [ ] As admin: edit a user, edit their scores, grant access, add/edit/delete a charity, simulate (random and weighted), publish, verify a winner, mark paid, and check Reports.
- [ ] Check the site on a phone.

## 10. Submit
Send Digital Heroes:
- the **live URL**
- the **admin** and **member** test credentials
- the **GitHub repo** link (the README explains your design decisions, including the "ambiguous requirements" section)

---

### Troubleshooting
- **"Almost there" screen:** the `VITE_` variables are missing. Add them in Vercel and redeploy.
- **Subscribe button gives an error:** check `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. The function logs are under Vercel → your project → Logs.
- **Paid but not active:** reload the dashboard. Also check the webhook in Stripe → Webhooks → your endpoint → recent deliveries.
- **`npm run seed:demo` says no charities:** run `supabase/seed.sql` first.
