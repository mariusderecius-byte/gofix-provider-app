# App Store metadata — GoFix Provider

For the **provider-side** companion app. The privacy policy hosted at https://gofix.app/privacy covers both apps.

## App name (30 chars max)

```
GoFix Provider
```

## Subtitle (30 chars max)

```
Get paid work near you
```

## Primary category

**Business** (gig-work and earning apps live here — see Uber Driver, Lyft Driver, TaskRabbit Tasker for precedent.)

## Secondary category (optional)

**Lifestyle**

## Promotional text (170 chars)

```
Plumbers, electricians, cleaners and tradespeople — get matched with paying jobs near you in Lithuania, Latvia and Estonia. Set your rate. Get paid via Stripe.
```

## Description (4,000 chars)

```
The companion app for skilled trades professionals on GoFix.

Get matched with paying customers in your city — set your hourly rate, pick the jobs you want, and get paid via Stripe within days of completion.

WHO IT'S FOR
- Plumbers, electricians, cleaners, carpenters, painters, movers and construction pros across Lithuania, Latvia and Estonia
- Independent contractors and small-team businesses looking for a steady stream of local work

HOW IT WORKS
1. Sign up and verify your identity (KYC by Veriff — takes about 5 minutes)
2. Connect your bank via Stripe Express to receive payouts
3. Pick the service categories you cover and set your hourly rate
4. Toggle availability on — incoming jobs from nearby customers come straight to your phone
5. Accept or decline each offer (2-minute window)
6. Navigate to the job with the built-in map and live ETA
7. Take a "before" photo, do the work, take an "after" photo
8. Mark the job complete — funds release from escrow once the customer confirms

WHAT YOU KEEP
- 85% of every job is yours
- Platform fee is 15%, flat, no surprises
- Payouts are processed weekly via Stripe to your bank account
- See your week-by-week earnings in real time

GET STARTED
1. Sign up with your phone number
2. Add your name, photo and a short bio about your work
3. Verify your identity via Veriff (passport or national ID)
4. Connect your bank with Stripe (takes 5 minutes)
5. Pick categories, set your rate, go live

REQUIREMENTS
- You must be self-employed or a registered business in Lithuania, Latvia or Estonia
- You must have a valid government-issued ID
- You must have a bank account that supports Stripe payouts (most Baltic banks do)
- You must have proof of insurance and any required professional licenses for your trade — we may ask for these during onboarding

TRANSPARENT MARKETPLACE
- See every offer's distance, customer description, estimated duration and full price before you accept
- Built-in chat keeps all communication in one place
- Rate every customer after the job — we use this to weed out bad ones
- Live location sharing is one-way (to the customer) and automatically stops when the job ends

DISPUTES AND PROTECTION
- 48-hour dispute window after every job — if a customer raises an issue, our admin team reviews the work documentation (before/after photos) and decides
- Honest reviews work both ways — your customer rating affects your match ranking

Available in Lithuania, Latvia and Estonia. Apply to be one of the first providers in a new city: <providers@gofix.app>

Support: <support@gofix.app>
Privacy: <https://gofix.app/privacy>
Terms: <https://gofix.app/terms>
```

## Keywords (100 chars)

```
freelance,trades,gigwork,plumber,electrician,cleaner,handyman,vilnius,riga,tallinn,jobs,earnings
```

(99 chars.)

## Support URL (REQUIRED)

```
https://gofix.app/providers/support
```

(Or the same `gofix.app/support` page if you'd rather have one combined page.)

## Marketing URL

```
https://gofix.app/providers
```

## Privacy Policy URL (REQUIRED)

```
https://gofix.app/privacy
```

(Same policy as user app.)

## Age rating

- Unrestricted Web Access: **No**
- User-generated Content: **Yes — Infrequent / Mild** (chat, reviews)
- Likely rating: **17+** because providers handle financial data and KYC of adult-only legal entities. (12+ also defensible — choose based on your legal advice.)

## App Store screenshots needed

Same device sizes as user app (6.7" + 6.1" iPhone). Suggested shots:
1. Jobs feed — incoming offers with €/hr, distance, ETA
2. Job detail — customer location, navigation, action button
3. Before-photo upload sheet — JobDocSheet "Document the site before starting"
4. Earnings — week-by-week breakdown, total payouts
5. Stripe Connect setup — the new "Connect a payout account" card on Profile

## App Review Notes

```
GoFix Provider is the companion gig-economy app for the GoFix platform
(separate app: app.gofix.user). This is the worker-side counterpart, same
model as Uber Driver vs Uber, Lyft Driver vs Lyft.

The app handles:
- Receiving job offers from verified customers
- In-person service delivery (plumbing, electrical work, cleaning, etc.)
- Receiving payouts via Stripe Connect to the provider's bank account

Test account for review:
  Email: <test provider email>
  Password: <test password>

The test account is already KYC-verified and Stripe-onboarded so the
reviewer can see all screens without external setup.

Contact: <your name and email>
```

## Pricing

Free.

## Availability

Lithuania, Latvia, Estonia.

## Notes

- **In-app purchase**: none. All transactions are off-platform service payments processed by Stripe and are exempt under App Store Review Guideline 3.1.3(e) — the same exemption used by Uber Driver, TaskRabbit Tasker, and every other gig-worker app.
- **Background location**: the provider app requests `NSLocationAlwaysAndWhenInUseUsageDescription`. Apple will ask why. Honest answer: "to share live location with the assigned customer during an active job, even when the app is backgrounded." Apple usually accepts this for delivery/services apps but be ready to clarify.
