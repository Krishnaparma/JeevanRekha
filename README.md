# 🚑 JeevanRekha — Suryanagar 108 Emergency Bed Network

**Emergency Hospital Bed allocator** — Graph + Priority Queue project.

User apni location choose karta hai → app aas-paas ke hospitals dikhata hai → har hospital ke
**khaali beds** dikhte hain → app **sabse nazdeek wala hospital suggest karta hai jahan bed available hai**.

- **Method 1 — Graph:** Suryanagar sheher ek weighted graph hai (58 vertices / chowk, 90 edges / sadak).
  Edge ka weight = `distance ÷ speed × traffic` (yaani asli travel time in minutes).
  Chandrabhaga nadi sirf 2 setu se paar hoti hai, railway line sirf 2 underpass se — isliye
  seedhi doori (straight line) aur asli road distance alag aate hain.
- **Method 2 — Priority Queue:** ek **binary min-heap** do jagah use hota hai —
  (1) Dijkstra ke fringe me, (2) hospitals ko rank karne me.
  Pehla `pop()` hamesha wahi hospital hota hai jo sabse paas hai **aur** jiske paas bed hai.

---

# ⚡ PART 1 — VS Code me kaise chalayein (5 steps)

## Step 0 — Ye cheezein install honi chahiye

| Cheez | Link | Check karne ka command |
|---|---|---|
| **Node.js 20+** | <https://nodejs.org> (LTS download karo) | `node -v` |
| **PostgreSQL 14+** | <https://www.postgresql.org/download/> | `psql --version` |
| **VS Code** | <https://code.visualstudio.com> | — |

> Install ke baad VS Code **band karke dobara kholna**, warna terminal me `node` command nahi milegi.

---

## Step 1 — Project VS Code me kholo

VS Code → `File` → `Open Folder…` → is project ka folder select karo.
Phir terminal kholo: **`Ctrl + ~`** (Mac par **`Cmd + ~`**).

---

## Step 2 — Packages install karo

```bash
npm install
```

---

## Step 3 — Database set karo

### 🅰️ Option A — Local PostgreSQL (normal tarika)

`app_db` naam ka database banao:

```bash
# Windows / Mac / Linux — password maangega, jo tumne Postgres install karte waqt rakha tha
psql -U postgres -c "CREATE DATABASE app_db;"
```

### 🅱️ Option B — Docker (sabse easy, kuch install nahi karna padta)

```bash
docker run --name jeevanrekha-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db -p 5432:5432 -d postgres:16
```

### Ab `.env` file banao

Project ke root me `.env` naam ki file banao (ya `.env.example` copy kar lo):

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

> `postgres:postgres` me doosra wala tumhara **password** hai — apne hisaab se badal lo.

### Tables banao

```bash
npx drizzle-kit push
```

✅ Suryanagar ka data (58 chowk, 90 sadak, 10 hospital) **apne aap bhar jayega** jab tum pehli
baar app khologe. Alag se seed command chalane ki zarurat nahi.

---

## Step 4 — App chalao

```bash
npm run dev
```

Browser me kholo 👉 **<http://localhost:3000>**

---

## Step 5 — Bas ho gaya 🎉

| Kaam | Kaise |
|---|---|
| Location badlo | Left panel ka dropdown, ya map par kisi bhi chowk par **click** |
| Bed type badlo | ICU / Ventilator / Emergency / General button |
| Algorithm dekho | *"Show Dijkstra exploration order"* checkbox tick karo — har chowk par settle number aur minute dikhega |
| Bed book karo | **"Block this bed"** → phir *Send 108 ambulance* → ambulance map par chalegi |
| Data reset | Header me **"Reset city"** button |

---

# 📱 PART 2 — Mobile par kaise dikhayein (4 tarike)

## 🥇 Tarika 1 — VS Code Port Forwarding (SABSE EASY, recommended)

Ye VS Code me **already built-in** hai, kuch install nahi karna. Kisi bhi network se chalta hai —
mobile data par bhi, alag WiFi par bhi.

1. Pehle app chalao: `npm run dev`
2. VS Code me neeche **`PORTS`** tab par click karo (`TERMINAL` ke bagal me hota hai)
   *Nahi dikh raha?* → `Ctrl + Shift + P` → type karo `Ports: Focus on Ports View`
3. **`Forward a Port`** button dabao → `3000` likho → Enter
4. Us row par **right-click** → `Port Visibility` → **`Public`** choose karo
5. `Forwarded Address` wale column me ek link aayega, jaise
   `https://abc123-3000.inc1.devtunnels.ms`
6. Us link ko **copy** karke WhatsApp par bhejo, ya QR code bana ke phone se scan karo 📲

> Pehli baar GitHub/Microsoft account se sign-in maang sakta hai — free hai.

---

## 🥈 Tarika 2 — Same WiFi par local IP se

Laptop aur phone **ek hi WiFi** par hone chahiye.

**A. App ko network par expose karo** (`-H 0.0.0.0` zaroori hai):

```bash
npx next dev -H 0.0.0.0 -p 3000
```

**B. Laptop ka IP address nikalo:**

```bash
# Windows
ipconfig
#   -> "IPv4 Address" dhoondo, jaise 192.168.1.5

# Mac
ipconfig getifaddr en0

# Linux
hostname -I
```

**C. Phone ke browser me kholo:**

```
http://192.168.1.5:3000
```

*(apna IP daalo)*

> ⚠️ **Na khule to?** Laptop ka firewall block kar raha hai.
> **Windows:** Windows Defender Firewall → *Allow an app* → **Node.js** ko **Private network** par tick karo.
> **Mac:** System Settings → Network → Firewall → Options → Node ko *Allow incoming connections*.

---

## 🥉 Tarika 3 — Public link (localtunnel / ngrok)

Kisi bhi internet se chalne wala link — demo ke liye perfect.

```bash
# Terminal 1
npm run dev

# Terminal 2 (naya terminal: Ctrl + Shift + ~)
npx localtunnel --port 3000
```

Ye `https://khaki-cat-12.loca.lt` jaisa link dega. Phone me kholo.
Password maange to <https://loca.lt/mytunnelpassword> par jo IP dikhe, wahi paste kar do.

**ngrok wala option:**

```bash
npx ngrok http 3000
```

---

## 🏅 Tarika 4 — Production mode (sabse fast, presentation ke liye best)

Demo dikhane se pehle ye chala lo — bahut smooth chalega, koi dev-mode lag nahi hoga:

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000
```

Phir upar wala Tarika 1 ya 2 use karo.

---

# 🧑‍🏫 PART 3 — Demo dikhane ka script (2 minute)

Teacher/friend ko dikhate waqt ye order follow karo:

1. **"Ye Suryanagar sheher ka road network hai"** — map dikhao.
   Nadi, 2 setu, railway line, flyover — sab point out karo.
2. **Location choose karo** — dropdown se *"Lohapur Colony"* select karo.
   → Turant route ban jayega aur suggestion card aa jayega.
3. **"Ye dekho — nazdeek wala hospital nahi, balki nazdeek wala JISKE PAAS BED HAI"**
   → Right side me list me dikhega ki jo hospital full hai wo **neeche** chala gaya hai.
4. **Bed type badlo** ICU → Ventilator → ranking turant badal jayegi.
5. **"Show Dijkstra exploration" tick karo** → har chowk par `0,1,2,3…` settle order aur minutes
   dikhenge. Yehi priority queue ka pop order hai. 👈 *Ye sabse impressive part hai*
6. **"Block this bed"** dabao → *Send 108 ambulance* → **ambulance map par chalti hui dikhegi**
   aur ETA ghat-ta jayega.
7. **Algorithm trace panel** dikhao (left, neeche): nodes settled, edge relaxations,
   heap push/pop, query time in ms.

---

# 🛠 PART 4 — Problem aaye to (Troubleshooting)

| Error | Solution |
|---|---|
| `DATABASE_URL is required` | `.env` file root folder me nahi hai, ya naam galat hai (`.env.txt` nahi chalega) |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL chal hi nahi raha. Docker: `docker start jeevanrekha-db`. Windows: Services → `postgresql` → Start |
| `password authentication failed` | `.env` me password galat hai |
| `relation "graph_nodes" does not exist` | `npx drizzle-kit push` chalana bhool gaye |
| `Port 3000 is already in use` | `npx next dev -p 3001` chalao, ya purana terminal band karo |
| Mobile par page nahi khul raha | `-H 0.0.0.0` lagana bhool gaye, ya firewall block kar raha hai — Tarika 1 (Port Forwarding) use karo |
| Map par hospital dikh hi nahi rahe | Header me **Reset city** dabao |
| `npm : command not found` | Node.js install karke VS Code **restart** karo |

---

# 📂 Code kahan kya hai

```
src/
├── lib/
│   ├── priorityQueue.ts   ⭐ Binary Min-Heap (push / pop / siftUp / siftDown)
│   ├── graph.ts           ⭐ Adjacency list + Dijkstra + hospital ranking heap
│   ├── city.ts               Suryanagar generator (chowk, sadak, nadi, hospital)
│   ├── queries.ts            Database + algorithm ko jodne wali layer
│   └── types.ts              Saare TypeScript types
├── db/
│   ├── schema.ts             5 tables (Drizzle ORM)
│   ├── seed.ts               Pehli baar data bharta hai
│   └── index.ts              Postgres connection
├── components/
│   ├── Console.tsx           Main screen
│   ├── CityMap.tsx           SVG map + ambulance animation
│   ├── LocationPanel.tsx     Step 1 & 2 (location + patient)
│   ├── ResultsPanel.tsx      Suggestion + ranked hospital list
│   └── DispatchPanel.tsx     108 ambulance tracking + live feed
└── app/
    ├── page.tsx              Home page (server rendered)
    └── api/                  route · requests · hospitals · simulate · reset · health
```

**Viva me ye 2 files kholna:** `src/lib/priorityQueue.ts` aur `src/lib/graph.ts` — pura algorithm
wahin hai, comments ke saath.

---

# 🔌 API (Thunder Client / Postman se test karo)

```bash
# Sabse nazdeek bed dhoondo
curl -X POST http://localhost:3000/api/route \
  -H "Content-Type: application/json" \
  -d '{"fromCode":"J51","bedType":"icu","severity":"urgent"}'

# Saare hospitals ke live beds
curl http://localhost:3000/api/hospitals

# Bed book karo
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"patientName":"Priya Deshmukh","patientAge":29,"severity":"critical","bedType":"ventilator","fromCode":"J26","hospitalId":4}'
```

---

## Commands ka summary

| Command | Kaam |
|---|---|
| `npm install` | Packages install |
| `npx drizzle-kit push` | Database tables banao |
| `npm run dev` | Laptop par chalao |
| `npx next dev -H 0.0.0.0` | Mobile ke liye chalao |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript errors check |
