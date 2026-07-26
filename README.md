# PromoTrack — Promotion Management System

A live check-in, hourly reporting, inventory, and end-of-day system for teams
running promotions across multiple locations at once — replacing the
WhatsApp-group workflow with one form and one live dashboard.

- **Manager Dashboard** — see every location's status, footfall, sales, stock
  alerts, and issues live, updating automatically every 6 seconds.
- **Promoter Portal** — check in, then submit hourly updates, inventory
  reports, and one end-of-day report per shift.
- Real backend: Node.js + Express API, data persisted to a JSON file on the
  server, shared by everyone who opens the app.

---

## 1. Running it locally (takes ~2 minutes)

**Requirements:** [Node.js](https://nodejs.org) version 18 or later.

```bash
# 1. unzip the project, then from inside the promotrack folder:
npm install

# 2. start the server
npm start
```

You'll see:

```
PromoTrack server running at http://localhost:3000
```

Open **http://localhost:3000** in your browser — that's the Manager
Dashboard. Anyone on the same Wi-Fi/network can reach it too, using your
computer's local IP instead of `localhost` (e.g. `http://192.168.1.20:3000`),
which is enough for a same-venue pilot without deploying anywhere.

Every promoter opens the same URL and switches to **Promoter Portal** in the
top right to check in and submit reports. Nothing needs installing on their
phones — it's a normal web page.

---

## 2. Will this deploy to a server automatically?

**No — I can't provision or deploy to a live server on your behalf.** I can
only hand you working, deploy-ready code. You (or your IT/dev contact) need
to actually put it on a server so it has a public URL your team can reach
from their phones outside your building's Wi-Fi. That said, this is a plain
Node.js app, so it deploys in a few clicks on any of these — pick one:

### Option A — Render.com (easiest, free tier available)
1. Push this folder to a GitHub repo (or use Render's "Deploy from folder" if offered).
2. On [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Deploy. Render gives you a public URL like `promotrack.onrender.com`.

### Option B — Railway.app
1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Railway auto-detects Node.js, runs `npm install && npm start`.
3. You get a public URL immediately; add a custom domain later if you want.

### Option C — A VPS you already have (DigitalOcean, AWS EC2, a company server, etc.)
```bash
# on the server
git clone <your repo>      # or upload the folder via scp/sftp
cd promotrack
npm install
npm install -g pm2         # keeps the app running after you log out / on reboot
pm2 start server.js --name promotrack
pm2 save && pm2 startup    # auto-restart on server reboot
```
Then point a domain or your server's IP + port 3000 at it (optionally put
Nginx in front for HTTPS on port 443).

### Option D — Docker (if your infra runs containers)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```
Build and run: `docker build -t promotrack . && docker run -p 3000:80 -v $(pwd)/data:/app/data promotrack`
(the volume mount keeps your data across container restarts).

I'm happy to walk through any one of these in detail, or generate the exact
files (Dockerfile, GitHub Actions deploy workflow, etc.) once you tell me
which host you're using.

---

## 3. How data is stored

All submissions are saved to `data/db.json` on the server — this is your
"central sheet." It's simple and needs zero setup, which is why it's the
default. Two things worth knowing as you scale:

- **Good for:** a single server instance, pilots, and teams up to the
  5–20 locations described in your requirements.
- **If you outgrow it:** swap the `readDb`/`writeDb` functions in
  `server.js` for a real database (Postgres, MySQL, MongoDB) — the API
  routes and frontend don't need to change, just the storage layer. Ask me
  and I can do this migration for you.
- **Back it up** by copying `data/db.json` periodically if this matters to
  your operation — there's no automatic backup built in yet.

---

## 4. Project structure

```
promotrack/
├── server.js          # Express API + serves the frontend
├── package.json
├── data/               # auto-created — db.json lives here (not in git)
└── public/
    ├── index.html
    ├── style.css       # professional theme (navy / white / blue)
    └── app.js          # dashboard + form logic, talks to the API
```

## 5. API reference (for future integrations)

| Method | Route             | Purpose                          |
|--------|--------------------|-----------------------------------|
| GET    | `/api/state`       | Full dashboard state (all locations) |
| GET    | `/api/locations`   | List of location names            |
| POST   | `/api/locations`   | Add a location `{ name }`         |
| POST   | `/api/checkin`     | `{ location, name }`              |
| POST   | `/api/hourly`      | Hourly update payload             |
| POST   | `/api/inventory`   | Inventory report payload          |
| POST   | `/api/eod`         | End of day report payload         |
| POST   | `/api/reset`       | Wipes all data — remove/protect this route before real production use |

---

## 6. Suggested next steps

- Add login/PIN per promoter so submissions can't be spoofed (currently
  anyone with the link can submit as anyone — fine for a trusted pilot, not
  for production).
- Add CSV/Excel export of the day's reports for management archiving.
- Add push/SMS/WhatsApp alerts when a low-stock or issue flag is raised.

Ask me to build any of these in and I'll extend the code.
