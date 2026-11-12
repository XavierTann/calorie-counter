# Makan Log

A calorie counter where you type what you ate in plain language ("roasted chicken rice less rice + kopi-c siew dai") and it fills in calories and macros. It's built around Singapore hawker food and home-cooked meals measured in scoops.

- **Hawker database**: ~120 dishes and kopitiam drinks with HPB-based values, in `lib/foods.ts`. Edit or add to it freely.
- **AI parsing** (Claude): understands hawker terms and modifiers (less rice, no skin, siew dai, kosong…). It checks the database first and searches the web only for things the database doesn't have. Foods found online are saved, so the next lookup is instant.
- **Home meals by scoop**: tap "Home meal" and count scoops, or just type "1 bowl rice, 2 scoops kailan, 1 scoop curry chicken". You can calibrate scoop sizes in Settings.
- **Cronometer-style dashboard**: calories eaten, budget, burned, remaining, and protein/carbs/fat bars.
- **Garmin**: burned calories adjust your daily budget (see below).
- **Installable on your phone (PWA)**: open the site in Safari/Chrome → Share → *Add to Home Screen*.

## Run locally

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Local data is stored in `local.db` (SQLite). If `APP_PASSWORD` isn't set, there's no login.

To try it on your phone over home Wi-Fi: `npm run dev -- -H 0.0.0.0`, then open `http://<your-mac-ip>:3000`.

## Deploy (free tiers)

1. **Database**: sign up at [turso.tech](https://turso.tech), then:
   `turso db create makan-log` → `turso db show makan-log --url` → `turso db tokens create makan-log`
2. **Push this folder to GitHub**, then import the repo at [vercel.com/new](https://vercel.com/new).
3. In Vercel → Settings → Environment Variables, add:
   `ANTHROPIC_API_KEY`, `APP_PASSWORD`, `INGEST_TOKEN` (any long random string), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
4. Deploy. On your phone, open the URL → log in → Share → **Add to Home Screen**.

Tables are created automatically on the first request.

## Garmin → burned calories

Garmin only gives API access to approved businesses, not personal accounts, so calories go Garmin → Apple Health → this app via an iPhone Shortcut.

### Option A: iPhone Shortcut (automatic)
1. In Garmin Connect: Settings → Connected Apps → **Apple Health** → turn on calories (Active Energy, Resting Energy).
2. In the **Shortcuts** app, create a shortcut:
   - *Find Health Samples* → Type: **Active Energy**, Start Date: **Today**. Then *Calculate Statistics* → **Sum**
   - *Find Health Samples* → Type: **Resting Energy**, Start Date: **Today**. Then *Calculate Statistics* → **Sum**
   - *Get Contents of URL* → `https://YOUR-APP/api/energy/sync`, Method **POST**,
     Headers: `Authorization` = `Bearer YOUR_INGEST_TOKEN`,
     Request Body **JSON**: `active` = (first sum), `resting` = (second sum), `source` = `garmin`
3. Automation tab → **Time of Day** (e.g. every hour, or at 12pm, 6pm and 10pm) → run the shortcut, with "Ask before running" off.

### Option B: Manual
Tap **Burned** on the dashboard and type the numbers from Garmin Connect.

### How the budget uses it (Settings)
- **Target + active (default)**: budget = your calorie target + Garmin *active* calories. Accurate all day.
- **Total − deficit**: budget = Garmin *total* calories − deficit. Only accurate at night, because resting calories build up through the day.

## Measuring mum's cooking by scoop

1. Use the same serving spoon each time. That's your "scoop".
2. **Calibrate once**: put a bowl on a kitchen scale, tare, add 1 scoop of a typical dish, note the grams, and look up kcal per 100 g (HPB / HealthHub). Update that scoop type in Settings. Do this for your usual rice bowl too.
3. Afterwards, either tap **Home meal** and count scoops (half scoops work), or type it ("1.5 bowl rice, 2 scoops kailan, 1 scoop braised pork").
4. Oily or fatty dishes vary the most. If a dish looks oilier than usual, add half a scoop.

## Notes
- Every logged item shows its source (hawker DB, home scoop, a website, or estimate) and confidence (●●● / ●●○ / ●○○). You can edit calories before saving.
- AI calls use Claude Opus 5.5 with server-side refusal fallbacks enabled. Each lookup costs a few US cents (more if it has to search the web). The hawker database is prompt-cached. To make it cheaper, change the model in `lib/parse.ts` to `claude-sonnet-5-5` or `claude-haiku-5-5`.
