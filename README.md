# X Auto Poster — Tech/AI Niche

> AI-powered tweet generator with push notifications. Runs locally on your phone.

## What it does

- Generates viral Tech/Coding/AI/ML tweets using Groq AI (Llama 3.1 70B)
- Sends push notifications at your scheduled times ("Time to post!")
- Tap the notification → opens X with your post pre-filled
- Two modes: **Review first** (you approve) or **Auto-schedule** (notified automatically)
- Topics: DSA, LeetCode, System Design, Python, Java, ML, LLMs, Backend, DevOps

---

## Setup (5 minutes)

### Step 1 — Get a free Groq API key

1. Go to https://console.groq.com
2. Sign up or log in
3. Create a new API key in your account
4. Copy it — looks like `gsk_…`
5. Free tier: Plenty of requests for daily posting!

### Step 2 — Run the app locally

You need Node.js installed (https://nodejs.org).

```bash
# In terminal, go to this folder
cd x-autoposter

# Start the local server
npx serve .
```

This starts a server at `http://localhost:3000`

### Step 3 — Open on your phone

1. Make sure your phone and PC are on the **same WiFi**
2. Find your PC's local IP:
   - Windows: run `ipconfig` → look for IPv4 Address (e.g. 192.168.1.5)
   - Mac/Linux: run `ifconfig` → look for inet (e.g. 192.168.1.5)
3. Open `http://192.168.1.5:3000` on your phone's browser

### Step 4 — Install as an app

**Android (Chrome):** Tap 3-dot menu → "Add to Home screen"
**iPhone (Safari):** Tap Share icon → "Add to Home Screen"

Now it's on your home screen like a real app!

### Step 5 — Enable notifications

- Open the app → Settings tab → tap "Enable reminders"
- Allow notifications when your phone asks
- Done! You'll get notified at every scheduled time.

---

## How to use

1. **Home tab** — Pick your topics, set post times, choose mode
2. **Hit "Generate today's posts"** — Google AI (Gemini) writes all posts
3. **Review mode:** Posts appear for you to read/edit → tap "Post" → copied + X opens
4. **Auto-schedule mode:** Posts are scheduled, notification fires at the right time → tap it → X opens pre-filled
5. **Settings tab** — Add API key, customize rules/tone

---

## Customizing post rules

In Settings → "Post rules & tone", you can tell Google AI exactly how to write:

- Your preferred tone (aggressive, humorous, educational)
- Topics to avoid
- Format preferences (threads, single tweets, with/without emojis)
- Persona ("write like a senior SWE at a FAANG" etc.)

---

## Cost

- Google AI: **FREE** (generous free tier: 60 req/min)
- Hosting: free (runs on your own machine)
- X API: not needed (we use X's web intent URL)

---

## Files

```
x-autoposter/
├── index.html    ← main app UI
├── app.js        ← all logic (Google AI API, notifications, scheduling)
├── style.css     ← mobile-first styles
├── sw.js         ← service worker (notifications + offline)
├── manifest.json ← PWA config (install as app)
└── README.md     ← this file
```
