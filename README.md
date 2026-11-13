# Makan Log

A calorie counter where you type what you ate in plain language ("roasted chicken rice less rice + kopi-c siew dai") and it fills in calories and macros. It's built around Singapore hawker food and home-cooked meals measured in tablespoons.

- **Official data first**: Singapore dishes come from HPB's SG FoodID, Korean from Korea's MFDS, Indian from the Indian Nutrient Databank, the rest from USDA FoodData Central (see below).
- **AI parsing** (Gemini, free tier): understands hawker terms and modifiers (less rice, no skin, siew dai, kosong…). It checks your Foods, the hawker database and your tablespoon sizes first and estimates anything else (low confidence). Tap **+**, type the meal, then check the working on the Check & log screen (base serving, each adjustment, total). If you correct the total, the app remembers it and uses your number next time.
- **Home meals by tablespoon**: type "1 bowl rice, 3 tbsp kailan, 2 tbsp curry chicken". You can calibrate tablespoon sizes in Settings.
- **Foods dictionary** (menu → Foods): every food you've logged, with its calories, which you can edit, plus custom foods you add yourself.
- **Cronometer-style dashboard**: calories eaten, budget, burned, remaining, and protein/carbs/fat bars, plus Bao, who's happy while you're within budget and sad when you go over.
- **Garmin**: burned calories adjust your daily budget (see below).
- **Installable on your phone (PWA)**: open the site in Safari/Chrome → Share → *Add to Home Screen*.

## Accounts

Anyone with the link can create an account (set `INVITE_CODE` to require a code). Each person has their own diary, burned calories, settings, foods and Apple Health sync token. The first account created takes over any data from before accounts existed. Everyone shares your Gemini free-tier quota.

## Run locally

```bash
cp .env.example .env.local   # add your GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Local data is stored in `local.db` (SQLite). Open the app, tap **Create an account**, and you're in.

To try it on your phone over home Wi-Fi: `npm run dev -- -H 0.0.0.0`, then open `http://<your-mac-ip>:3000`.

## Deploy (free tiers)

1. **Database**: sign up at [turso.tech](https://turso.tech), then:
   `turso db create makan-log` → `turso db show makan-log --url` → `turso db tokens create makan-log`
2. **Push this folder to GitHub**, then import the repo at [vercel.com/new](https://vercel.com/new).
3. In Vercel → Settings → Environment Variables, add:
   `GEMINI_API_KEY`, `AUTH_SECRET` (any long random string), `INVITE_CODE` (optional), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and for reminders `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`
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
     Headers: `Authorization` = `Bearer YOUR_SYNC_TOKEN` (each person's token is in their Settings),
     Request Body **JSON**: `active` = (first sum), `resting` = (second sum), `source` = `garmin`
3. Automation tab → **Time of Day** (e.g. every hour, or at 12pm, 6pm and 10pm) → run the shortcut, with "Ask before running" off.

### Option B: Manual
Tap **Burned** on the dashboard and type the numbers from Garmin Connect.

### How the budget uses it (Settings)
- **Target + active (default)**: budget = your calorie target + Garmin *active* calories. Accurate all day.
- **Total − deficit**: budget = Garmin *total* calories − deficit. Only accurate at night, because resting calories build up through the day.

## Weight and the 9am reminder

Menu → **Weight** to log weigh-ins, see the trend and set a goal. To get a morning nudge, add the app to your iPhone home screen, open it from there, go to Weight → **Turn on 9am reminder**, then **Send a test**. A Vercel Cron job (`vercel.json`, 01:00 UTC = 9am Singapore) reminds everyone with reminders on who hasn't weighed in that day. On Vercel's free plan the job runs some time within that hour. Generate the keys once with `npx web-push generate-vapid-keys`.

## Measuring mum's cooking by tablespoon

1. Use a normal tablespoon, heaped the way you'd normally scoop. Rice is still counted by the bowl.
2. **Calibrate once**: put a bowl on a kitchen scale, tare, add 1 tablespoon of a typical dish, note the grams, and look up kcal per 100 g (HPB / HealthHub). Update that dish type in Settings. Do this for your usual rice bowl too.
3. Afterwards, type it: "1.5 bowl rice, 4 tbsp kailan, 3 tbsp braised pork".
4. Oily or fatty dishes vary the most. If a dish looks oilier than usual, add a tablespoon.

## Where the calories come from

For each meal the app works out the cuisine from keywords (one cuisine per meal, Singapore by default) and looks up official data before the AI estimates anything:

1. **Your Foods**: custom foods and numbers you corrected.
2. **Home units**: your tablespoon/bowl sizes for home cooking.
3. **Official datasets** (loaded into the `ref_foods` table):
   - Singapore (the default): HPB's Singapore Food Insights Database (SG FoodID), every "freshly prepared" food and drink (hawker, food court and restaurant items). Fetched politely by `scripts/ref/fetch_sgfoodid.mjs` under the SG FoodID Terms of Use (section 10), with the required notice shown on the login page and in Settings.
   - Korean: Korea Ministry of Food and Drug Safety, *통합식품영양성분정보(음식)* (KOGL Type 1), ~1,600 restaurant and home dishes.
   - Indian: Indian Nutrient Databank (Vijayakumar et al., *Current Developments in Nutrition*, 2024), ~800 recipes. Deep-fried recipes are left out because the source counts all frying oil as eaten.
   - Anything else not covered: USDA FoodData Central (live API, per 100 g). Set `FDC_API_KEY`.
4. **AI estimate** as the last resort, marked low confidence.

To rebuild the datasets: run `node scripts/ref/fetch_sgfoodid.mjs` (about 40 minutes, cached and resumable), download the Korean and Indian sources, then run `python3 scripts/ref/prepare_korea.py <csv>`, `python3 scripts/ref/prepare_india.py <INDB.xlsx> <recipes_servingsize.xlsx>` and `node scripts/ref/import.mjs` (add `--local` for `local.db`). The prepared files are in `data/ref/`.

## Notes
- Every logged item shows its source (hawker database, home cooking, My foods or AI estimate) and confidence (●●● high / ●●○ medium / ●○○ low). You can edit calories before saving.
- AI calls use the Gemini API free tier (tries `gemini-3.6-flash`, then `gemini-3.5-flash-lite`, then `gemini-3.8-flash` if a model is busy; set `GEMINI_MODEL` to try a specific one first). Get a key at aistudio.google.com/apikey, no card needed. Google may use free-tier requests to improve its products. Google Search grounding isn't on the free tier, so foods outside the database are estimated from the model's own knowledge.
