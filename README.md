# Thwaha Forwarder Bot

A Telegram userbot forwarder — log in multiple accounts, set a message, and blast it to all groups on a schedule.

---

## Setup

### 1. Install dependencies
```bash
cd thwaha-forwarder-bot
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in:
```
BOT_TOKEN=       # From @BotFather
MONGODB_URI=     # Your MongoDB connection string
API_ID=          # From https://my.telegram.org
API_HASH=        # From https://my.telegram.org
PORT=3000
```

### 3. Seed the database (creates admins + system doc)
```bash
npm run seed
```

### 4. Start the bot
```bash
npm start
# or for dev with auto-reload:
npm run dev
```

---

## Usage Flow

1. `/start` — Opens the main menu (admin only: user IDs 8486646787 and 1632962204)
2. **Add Account** — Login a Telegram account one at a time (OTP + optional 2FA)
3. **Bulk Login** — Upload a `.csv` or `.txt` file:
   - Format: `+919876543210,password` or just `+919876543210`
   - Missing passwords are requested mid-batch
4. **Join Groups** — Manually join groups from each userbot account (on your phone). The bot detects groups automatically on login.
5. **Set Message** — Send any message type: text, photo, video, GIF, document, audio
6. **Set Interval** — Choose preset (5min, 10min, 30min, 1hr, 3hr, 6hr) or custom
7. **Start Forwarding** — Bot sends to all accounts' groups on the interval
8. **Stop Forwarding** — Pauses the scheduler
9. **Language** — Toggle between English and Romanized Hindi

---

## Express Route
```
GET /ping  →  "hello world"
```

---

## Project Structure
```
thwaha-forwarder-bot/
├── index.js              # Entry point, bot wiring
├── seed.js               # DB seeder (run once)
├── models/
│   └── db.js             # Mongoose schemas
└── helpers/
    ├── telegram.js       # GramJS auth (DC migration, device fingerprinting)
    ├── handlers.js       # All bot handler logic
    ├── forwarder.js      # Forwarding engine
    ├── sessions.js       # In-memory session store
    ├── csvParser.js      # Bulk file parser
    ├── i18n.js           # EN + Romanized Hindi strings
    └── launchbot.js      # Bot launch with retry
```
