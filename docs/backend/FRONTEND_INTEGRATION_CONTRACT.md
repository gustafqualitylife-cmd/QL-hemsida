# FRONTEND ↔ BACKEND INTEGRATION SPEC
## QualityLife Booking System

---

## ⚠️ VIKTIGT

Detta dokument är **den enda sanningen** för hur frontend ska byggas och kopplas till backend.

AI ska följa detta dokument strikt och **inte anta något** som inte uttryckligen står här.

---

## 1. Systemöversikt

Systemet består av **tre separata frontend-delar** på **två separata domäner**:

### Domän 1: Befintlig Eleventy-site (kunddomän)
- **Bokningskomponent** — inbyggd i befintlig Eleventy-site som en isolerad HTML/JS-komponent
- Ingen inloggning krävs
- Ska följa befintlig CSS-struktur i Eleventy-projektet

### Domän 2: Dashboard-app (intern domän, t.ex. `admin.qualitylife.se`)
- **Säljar-dashboard** — inloggad vy för säljare
- **Admin-dashboard** — inloggad vy för admin
- Helt separat från kunddomänen
- Byggs som en fristående app (React + Tailwind rekommenderas)

Backend är färdig, säker och race-safe.
Frontend ska **endast konsumera existerande API-endpoints**.

---

## 2. Teknikförutsättningar (låst)

### Bokningskomponent (Eleventy)
- Ren HTML + vanilla JS (inga frameworks)
- Följer befintlig CSS-struktur i Eleventy-projektet
- Ingen Supabase Auth krävs
- Kommunicerar direkt med backend-API

### Dashboard-app (separat domän)
- React + Tailwind (rekommenderat)
- Supabase Auth för inloggning
- JWT skickas i Authorization-header på alla skyddade anrop
- Aldrig skriva direkt till databasen
- Endast använda dokumenterade endpoints

Backend körs på Render:
`https://ql-hemsida.onrender.com`

Supabase Project URL:
`https://joynmufuivwwyhfnbeae.supabase.co`

---

## 3. Autentisering (gäller Dashboard-appen)

### Inloggning
Frontend använder Supabase Auth:
- Email + lösenord

Efter login:
- Hämta `access_token`
- Spara token i `sessionStorage` (MVP)
- Skicka alltid: `Authorization: Bearer <JWT>`

### Roller
Frontend får aldrig gissa roll.
Backend avgör access via RLS.

Profiler:
- `admin`
- `seller`

### Redirect-logik
- Vid `401/403`: redirect till `/login`
- Efter login: läs roll från Supabase Auth och redirect till rätt dashboard

---

## 4. DEL 1: Bokningskomponent (Eleventy-site)

### Beskrivning
En isolerad komponent som byggs in i befintlig Eleventy-sida.
Ska **inte** bryta befintlig CSS eller layout.
Ska använda befintliga CSS-klasser där möjligt.

### Funktioner
- Visa lediga tider som en lista eller kalender-vy
- Bokningsformulär med alla obligatoriska fält
- Kampanjkod-fält (valfritt)
- Tydlig bekräftelse eller felmeddelande efter bokning

### API

#### Hämta lediga tider
```
GET /api/times
```
Svar:
```json
[
  { "id": "uuid", "start_time": "2025-11-22T09:00:00Z" }
]
```

#### Boka tid
```
POST /api/book
```
Body:
```json
{
  "time_id": "uuid",
  "name": "Förnamn Efternamn",
  "address": "Adress",
  "phone": "Telefon",
  "email": "E-post",
  "service": "mattvätt",
  "promo_code": "TEST50"
}
```
Svar:
```json
{
  "success": true,
  "booking_id": "...",
  "base_price_sek": 1500,
  "discount_percent": 50,
  "final_price_sek": 750,
  "promo_code_valid": true,
  "promo_code_reason": null
}
```

### 🛑 PRISREGEL
Backend är **enda sanningen** för pris.
Frontend får **aldrig** räkna ut priset själv.
Frontend får **aldrig** validera kampanjkoder lokalt.
Frontend visar **endast** svaret från backend.
Om ogiltig kod: bokning genomförs till ordinarie pris, `promo_code_valid: false`.

### UX-krav för bokningskomponenten
- Loading-state medan tider hämtas
- Loading-state under bokning (knapp inaktiveras)
- Tydligt felmeddelande om tid är upptagen
- Tydlig bekräftelse med pris och eventuell rabatt efter lyckad bokning
- Formulär återställs efter lyckad bokning

---

## 5. DEL 2: Säljar-dashboard (separat domän)

### Beskrivning
Mobiloptimerad vy för säljare.
Säljare får **endast** se sina egna tilldelade bokningar.
Säljare kan även göra bokningar åt kunder direkt vid dörren via ett inbyggt bokningsflöde.

### Navigation
Säljar-dashboarden har en meny med två huvudsektioner:
1. **Mina bokningar** — lista över tilldelade bokningar
2. **Boka åt kund** — bokningsformulär för att göra en bokning vid dörren

### Sidor

#### `/login`
- Email + lösenord via Supabase Auth
- Efter login: redirect till `/`

#### `/` — Bokningsöversikt (huvudvy)
Ett riktigt bokningssystem-utseende:
- Lista/kalender med alla tilldelade bokningar
- Varje bokning visar: kundnamn, adress, datum/tid, status (färgkodad)
- Klickbar rad → går till detaljvy
- Filtrerbar på status

#### `/bookings/:id` — Detaljvy
- All bokningsinformation
- Statusuppdatering (dropdown/knappar)
- Filuppladdning (kamera-first på mobil)
- Lista över uppladdade filer

#### `/book` — Boka åt kund (säljarens bokningsvy)
Säljaren kan stå vid kundens dörr och göra en bokning direkt i sin dashboard.

Formulär innehåller exakt samma fält som den publika bokningskomponenten:
- Välj ledig tid (hämtas från `GET /api/times`)
- Kundens namn
- Kundens adress
- Kundens telefon
- Kundens e-post
- Tjänst (mattvätt / möbeltvätt / madrasstvätt)
- Kampanjkod (valfritt)

⚠️ **Viktigt:** Säljaren skickar bokningen via samma publika endpoint som kunden (`POST /api/book`).
Ingen autentisering krävs för själva bokningen — det är samma API som kundflödet.
Fältet `seller_name` skickas automatiskt med säljarens namn från den inloggade sessionen.

Efter lyckad bokning:
- Visa bekräftelse med pris, eventuell rabatt och boknings-ID
- Erbjud knapp för att göra en ny bokning

### 💡 Kampanjkod för gratis bokning
Säljaren kan använda en kampanjkod med `discount_percent: 100` för att boka helt gratis åt en kund.
Ingen ny backend-logik krävs — admin skapar koden i admin-dashboarden.
Koden fungerar precis som alla andra kampanjkoder.

### API

#### Lista egna bokningar
```
GET /api/seller/my-bookings
Authorization: Bearer <JWT>
```

#### Bokningsdetalj
```
GET /api/seller/bookings/:id
Authorization: Bearer <JWT>
```
Svar inkluderar bokningsdata + filer.

#### Uppdatera status
```
PATCH /api/seller/bookings/:id/status
Authorization: Bearer <JWT>
```
Body: `{ "status": "visited" }`

Tillåtna statusar:
- `assigned`
- `visited`
- `won`
- `lost`
- `no_show`

#### Ladda upp fil
```
POST /api/seller/bookings/:id/files
Authorization: Bearer <JWT>
Content-Type: multipart/form-data
```
Form-data:
- `file` → jpg/png/webp/pdf (max 10MB)
- `file_type` → `offer` | `before` | `after` | `other`

#### Boka åt kund (säljarens bokningsflöde)
```
GET /api/times                          (hämta lediga tider, ingen auth)
POST /api/book                          (skicka bokning, ingen auth)
```
Body för `POST /api/book`:
```json
{
  "time_id": "uuid",
  "name": "Kundens namn",
  "address": "Kundens adress",
  "phone": "Kundens telefon",
  "email": "Kundens e-post",
  "service": "mattvätt",
  "seller_name": "Säljarens namn (hämtas automatiskt från inloggad session)",
  "promo_code": "GRATIS100"
}
```

### UX-krav säljar-dashboard
- Mobil-first design
- Tydlig meny med "Mina bokningar" och "Boka åt kund"
- Kamera-first för filuppladdning på mobil
- Färgkodade statusar (t.ex. grön = won, röd = lost, gul = assigned)
- Loading-states på alla anrop
- Tydliga felmeddelanden
- Bokningsformuläret ska vara snabbt och enkelt att fylla i på mobil

---

## 6. DEL 3: Admin-dashboard (separat domän, samma app)

### Beskrivning
Desktop-optimerad vy för admin.
Admin ser allt och kan göra allt utom att skapa bokningar.

### Sidor

#### `/admin/login`
- Email + lösenord via Supabase Auth
- Efter login: redirect till `/admin`

#### `/admin` — Bokningsöversikt
- Tabell med alla bokningar
- Filtrerbar på status, säljare, datum
- Sökbar på kundnamn/email
- Klickbar rad → detaljvy

#### `/admin/bookings/:id` — Detaljvy
- All bokningsinformation inklusive pris och kampanjkod
- Tilldela säljare (dropdown med alla säljare)
- Ändra status
- Ändra betalningsstatus
- Se och ladda upp filer

#### `/admin/sellers` — Säljarlista
- Lista alla säljare (från `/api/admin/sellers`)
- Visar email och roll

#### `/admin/times` — Tidhantering
- Lista alla tider (bokade och lediga)
- Lägg till ny tid
- Ta bort oledad tid

#### `/admin/promo-codes` — Kampanjkoder
- Lista alla kampanjkoder med status och användning
- Skapa ny kampanjkod
- Aktivera/inaktivera kod
- Redigera befintlig kod

### API

#### Bokningar
```
GET  /api/admin/bookings
GET  /api/admin/bookings/:id
PATCH /api/admin/bookings/:id/assign    body: { seller_user_id, seller_name }
PATCH /api/admin/bookings/:id          body: { status, payment_status }
```

#### Säljare
```
GET /api/admin/sellers
```

#### Tider
```
GET    /api/admin/times
POST   /api/admin/times      body: { start_time }
DELETE /api/admin/times/:id
```

#### Kampanjkoder
```
GET   /api/admin/promo-codes
POST  /api/admin/promo-codes   body: { code, discount_percent, active, usage_limit }
PATCH /api/admin/promo-codes/:id
```

#### Filuppladdning (admin)
```
POST /api/admin/bookings/:id/files
Authorization: Bearer <JWT>
Content-Type: multipart/form-data
```

### UX-krav admin-dashboard
- Desktop-optimerad (men responsiv)
- Tabeller med sortering och filtrering
- Bekräftelsedialoger vid destruktiva åtgärder (t.ex. ta bort tid)
- Loading-states på alla anrop
- Tydliga felmeddelanden

---

## 7. Filhantering

- Alla filer lagras i Supabase Storage, bucket: `booking-files`
- Bucket är private
- Metadata sparas i `booking_files`
- Frontend får **endast** använda URL:er som returneras från backend
- Frontend får **aldrig** bygga public URLs själv

---

## 8. Absoluta förbud

AI får INTE:
- Skapa nya endpoints
- Ändra backend-logik
- Hoppa över auth på skyddade routes
- Visa data utan API-svar
- Lagra JWT osäkert (ej localStorage)
- Gissa roller
- Blanda ihop Eleventy-komponenten med dashboard-appen

---

## 9. Framtida (implementera ej nu)
- AI-analys av offerter
- Kundportal
- Betalningsintegration
- CORS-begränsning till specifik domän (sätts när domän är känd)

---

## 10. Slutregel

Om något är oklart: stoppa och fråga istället för att anta.
Backend är korrekt byggd.
Frontendens enda uppgift är att koppla rätt, visa rätt, aldrig bryta säkerheten.