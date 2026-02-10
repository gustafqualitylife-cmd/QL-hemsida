# Frontend Ultra Brief – QualityLife Booking System

## Arkitektur

Systemet är uppdelat på **två separata domäner** med **tre delar**:

---

### Del 1 – Bokningskomponent (Eleventy-site, kunddomän)
- Byggs som en isolerad HTML + vanilla JS komponent
- Inget framework, inga externa dependencies utöver Supabase JS (om nödvändigt)
- Följer befintlig CSS-struktur i Eleventy-projektet
- Ingen inloggning
- Byggs separat och kopplas in i Eleventy-sidan

### Del 2 & 3 – Dashboard-app (intern domän, t.ex. `admin.qualitylife.se`)
- Byggs som en separat fristående app (React + Tailwind rekommenderas)
- Innehåller både säljar-dashboard och admin-dashboard
- Supabase Auth för inloggning
- Hålls **helt separat** från Eleventy-siten

---

## Miljöer

**Backend Base URL:** `https://ql-hemsida.onrender.com`
**Supabase Project URL:** `https://joynmufuivwwyhfnbeae.supabase.co`

---

## Del 1: Bokningskomponent

**Placering:** Inbyggd i befintlig Eleventy-sida (t.ex. `/boka`)
**Teknik:** HTML + vanilla JS
**CSS:** Följer befintlig CSS-struktur

Funktioner:
- Hämta och visa lediga tider: `GET /api/times`
- Bokningsformulär med alla fält + kampanjkod-fält
- Skicka bokning: `POST /api/book`
- Visa bekräftelse med pris och eventuell rabatt

---

## Del 2: Säljar-dashboard

**Placering:** Separat domän, t.ex. `admin.qualitylife.se/seller`
**Teknik:** React + Tailwind
**Design:** Mobil-first

### Navigation
Meny med två sektioner:
- **Mina bokningar** — lista över tilldelade bokningar
- **Boka åt kund** — bokningsformulär för dörr-bokning

### Sidor
| Sida | Funktion | API |
|------|----------|-----|
| `/login` | Inloggning | Supabase Auth |
| `/` | Bokningsöversikt — lista/kalender, färgkodade statusar, filterbar | `GET /api/seller/my-bookings` |
| `/bookings/:id` | Detaljvy — status, filuppladdning, filer | `GET /api/seller/bookings/:id` `PATCH .../status` `POST .../files` |
| `/book` | **Boka åt kund** — säljaren fyller i kundens uppgifter vid dörren, väljer tid, eventuell kampanjkod | `GET /api/times` `POST /api/book` |

### Säljarens bokningsflöde (`/book`)
- Samma formulär och API som kundflödet (`POST /api/book`)
- `seller_name` skickas automatiskt från inloggad session
- Säljaren kan använda en kampanjkod med `discount_percent: 100` för gratis bokning
- Ingen ny backend-logik krävs — admin skapar koden i admin-dashboarden

---

## Del 3: Admin-dashboard

**Placering:** Separat domän, t.ex. `admin.qualitylife.se/admin`
**Teknik:** React + Tailwind
**Design:** Desktop-optimerad

Sidor:
| Sida | Funktion | API |
|------|----------|-----|
| `/admin/login` | Inloggning | Supabase Auth |
| `/admin` | Alla bokningar — tabell, filter, sök | `GET /api/admin/bookings` |
| `/admin/bookings/:id` | Detaljvy — tilldela säljare, status, betalning, filer | Flera PATCH-endpoints |
| `/admin/sellers` | Lista säljare | `GET /api/admin/sellers` |
| `/admin/times` | Hantera tider — lägg till, ta bort | `GET/POST/DELETE /api/admin/times` |
| `/admin/promo-codes` | Hantera kampanjkoder — skapa, aktivera, redigera | `GET/POST/PATCH /api/admin/promo-codes` |

---

## Säkerhet

- JWT lagras i `sessionStorage` (MVP)
- Alla skyddade requests: `Authorization: Bearer <JWT>`
- Vid `401/403`: redirect till login
- Aldrig skriva direkt till Supabase-databasen

---

## Definition of Done (MVP)

- [ ] Kund kan se lediga tider och boka på Eleventy-siten
- [ ] Kund ser tydlig bekräftelse med pris och eventuell kampanjrabatt
- [ ] Säljare kan logga in och se sina bokningar i en snygg bokningsvy
- [ ] Säljare kan öppna detaljvy, uppdatera status och ladda upp bild
- [ ] Säljare kan göra en bokning åt en kund direkt via `/book`
- [ ] Säljarens namn läggs automatiskt till på bokningen
- [ ] Admin kan logga in och se alla bokningar
- [ ] Admin kan tilldela säljare till en bokning
- [ ] Admin kan hantera tider och kampanjkoder
- [ ] Uppladdad fil syns i Supabase Storage