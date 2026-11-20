# AutoDealer website (Next.js)

The AutoDealer marketplace website, built with Next.js (App Router), React, Tailwind CSS, React Hook Form and Zod. It has the same screens, layout and light/dark design as before. All data now comes from the AutoDealer API (`autodealer-api`).

## Run it locally

Start the API first (see `autodealer-api/README.md`). Then:

```bash
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                     # http://localhost:3000
```

### Speed: `npm run dev` vs `npm run fast`

`npm run dev` is for editing code. It builds each page the first time you open it, so the first visit to every page and dashboard section takes 1–10 seconds (it uses Turbopack, which is faster than the old builder, but still compiles on demand).

To use or test the site at real speed, run the production build:

```bash
npm run fast                    # build once, then serve: pages open in well under a second
```

Measured here: dealer dashboard sections open in 50–150 ms with `npm run fast`, against 1–4 s on their first visit with `npm run dev`.

For production, run `npm run build && npm start`. You can also deploy to Vercel or any Node.js host. Set `NEXT_PUBLIC_API_URL` to the API's public address, and add the site's address to the API's `CORS_ORIGINS`.

## Signing in

- **Dealers, sellers, agents, buyers and partner banks** sign in with their mobile number and a 6-digit SMS code. Until an SMS provider is set on the API (`OTP_PROVIDER=console`), the code is shown on screen and printed in the API log.
- **Admins** sign in at `/admin/login` with email, password and an authenticator-app code. New admins activate their account at `/admin/invite` with an invitation code; it shows a real QR code to scan.
- **Partner banks** use `/bank-portal` with their lead desk's number.
- When the API runs with `ALLOW_DEMO_LOGIN=true`, an **All screens** button appears at the bottom left. It switches between the demo accounts and jumps to any screen. It is hidden in production.

## How it's organised

```
src/
  app/                 Next.js routes (one folder per URL) and layouts
    (public)/          marketplace pages: home, [category] browse and listing pages, dealers, loan calculator, guest conversations…
    (auth)/            sign-in, registration, buyer onboarding
    (standalone)/      admin sign-in, admin invite, bank lead desk
    (dash)/            dashboards for dealer, seller, agent, buyer, admin, plus account and payments (each area checks the role)
    Providers.jsx      theme, toasts, data store; shows a loader until the data has arrived
    Area.jsx           puts each page inside the right layout and role check
  screens/             the page components (same screens as before)
  components/          shared UI, vehicle, finance, documents and listing components
  layouts/             public, sign-in and dashboard layouts
  store/AppStore.jsx   app data and actions; every change is sent to the API
  lib/api.js           API client (adds the sign-in token, turns errors into messages)
  lib/router.jsx       Link, useNavigate, useSearchParams… on top of the Next.js router
  styles/              Tailwind layers and the light/dark theme
public/                vehicle photos and brand images
```

The screens call `useStore()` as before. The store loads everything for the signed-in visitor from `GET /api/bootstrap`. Each action (save a listing, pay, send an enquiry, review a document…) calls the API and then shows what the server saved. Quick actions such as "Mark sold" or admin moderation update the screen at once. If the server refuses, the screen shows the reason and reloads the saved data.

The compare list and recently viewed vehicles stay in the browser. A guest's saved vehicles, saved searches and preferences also stay in the browser, and move to the buyer's account when they sign in.

## Vehicle categories

Categories come from the API, so nothing about them is hard-coded in the website. Admins manage them at **Admin → Vehicle categories** (`/admin/categories`):

- **Add** a category: name, web address, icon, illustration, optional home-page picture, types, fuels, transmissions, usage in kilometres or hours, budget steps, specifications (with required and filter options), brands, features and TRA vehicle classes.
- **Edit or rename** one. Changing the web address keeps the old address working: for example `/lorries` redirects to `/trucks-trailers`.
- **Hide** one. It disappears from menus, search and the listing form, and its listings are hidden from the public.
- **Reorder** with the up and down arrows. Menus, the home page, the search tabs and the listing form follow this order.
- **Remove** one. If listings use it, you choose a category to move them to.

The website reads them in `src/data/vehicleTypes.js` (`setCategories()` runs whenever the store loads data). One dynamic route, `src/app/(public)/[category]/…`, serves every category's browse page, listing page and contact page. The specification fields every category can use are defined once in `src/data/specFields.js`. The listing form, filters, listing cards, detail pages and comparisons are all built from these settings. To offer a new kind of specification, add it there and to `SPEC_FIELD_KEYS` in the API's `src/shared/categories.js`.

## Messages, live notifications and featured listings

- **Chat.** Every enquiry is a conversation. Sellers (private, agent, dealer) reply in their **Enquiries** inbox, with call and WhatsApp buttons alongside. Signed-in buyers reply from **Messages** (`/buyer/messages`). Guest buyers continue at `/messages/<id>?key=…`; the link reaches them by SMS when the seller replies, and is remembered on the device they wrote from. Messages show "Seen" once read, and inboxes show unread counts.
- **Live updates.** `src/lib/realtime.js` keeps a connection to the API (`GET /api/events`). New enquiries, messages, "seen" receipts, notifications and listing changes (price drops, sold) appear without reloading, with a toast and, if the visitor allows it, a desktop alert while the tab is in the background. If the connection drops it reconnects by itself and catches up. The bell in the header (`components/layout/NotificationBell.jsx`) shows unread notifications and puts the count in the browser tab title.
- **Saved vehicles.** Signed-in buyers are notified when a vehicle they saved changes price, is updated, sold or taken down.
- **Several listings per private seller.** Private sellers manage their vehicles in **My listings** (`/seller/listings`). Admins can set a limit in Admin → Configuration (0 = no limit).
- **Featured.** Every seller type has a featured plan at checkout, and any live listing can be featured later from the listings menu ("Feature this listing", `/checkout/<id>?boost=1`). Admins can feature or stop featuring a listing from its admin page, and set how long boosts last.

## Light and dark mode

The site opens in light mode. The sun/moon switch in the header changes it, and the choice is remembered on the visitor's browser. To open in dark mode by default, change `DEFAULT_THEME` in `src/store/StyleContext.jsx` and the default in the theme script in `src/app/layout.jsx`.
