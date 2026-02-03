# FRONTEND ↔ BACKEND INTEGRATION SPEC  
## QualityLife Booking System

---

## ⚠️ VIKTIGT

Detta dokument är **den enda sanningen** för hur frontend ska byggas och kopplas till backend.

AI ska följa detta dokument strikt och **inte anta något** som inte uttryckligen står här.

---

## 1. Systemöversikt

Systemet består av tre användarvyer:

- Publik kundvy (ingen inloggning)
- Säljvy (inloggad via Supabase Auth)
- Adminvy (inloggad via Supabase Auth)

Backend är färdig, säker och race-safe.

Frontend ska **endast konsumera existerande API-endpoints**.

---

## 2. Teknikförutsättningar (låst)

Frontend ska:

- Använda Supabase Auth för inloggning
- Skicka JWT i Authorization-header
- Aldrig använda legacy tokens
- Aldrig skriva direkt till databasen
- Endast använda dokumenterade endpoints

Backend körs på Render och är redan deployad.

---

## 3. Autentisering (obligatoriskt)

### Inloggning

Frontend använder Supabase Auth:

- Email + lösenord

Efter login:

- Hämta `access_token`
- Spara token i minne eller secure storage
- Skicka alltid:

Authorization: Bearer <JWT>


### Roller

Frontend får aldrig gissa roll.  
Backend avgör access via RLS.

Profiler:

- admin
- seller
- user

---

## 4. Vy 1: Publik kundvy (ingen inloggning)

### Funktioner

- Visa lediga tider
- Boka tid

### API

#### Hämta tider

GET /api/times


Svar:

```json
[
  { "id": "uuid", "start_time": "2025-11-22T09:00:00Z" }
]
Boka tid
POST /api/book
Body:

{
  "time_id": "uuid",
  "name": "Förnamn Efternamn",
  "address": "Adress",
  "phone": "Telefon",
  "email": "E-post"
}
⚠️ Viktigt
Bokning är race-safe

Om tiden är upptagen returneras fel

Frontend måste visa tydligt felmeddelande

5. Vy 2: Säljvy (inloggad)
Säljare får:

Endast se egna bokningar

Aldrig se andra säljares bokningar

API
Lista egna bokningar
GET /api/seller/my-bookings
Bokningsdetalj
GET /api/seller/bookings/:id
Svar inkluderar:

Bokningsdata

Filer

(framtida AI-data)

Uppdatera status
PATCH /api/seller/bookings/:id/status
Body:

{ "status": "visited" }
Tillåtna statusar:

assigned

visited

won

lost

no_show

Filuppladdning
POST /api/seller/bookings/:id/files
Form-data:

file → jpg/png/pdf

file_type → offer | before | after | other

Frontend ska:

Använda mobilkamera när möjligt

Visa uppladdade filer direkt

Visa tydlig feedback

6. Vy 3: Adminvy (inloggad)
Admin får:

Se alla bokningar

Tilldela säljare

Ändra status och betalning

Se alla filer

API
Lista bokningar
GET /api/admin/bookings
Lista säljare
GET /api/admin/sellers
Tilldela säljare
PATCH /api/admin/bookings/:id/assign
Body:

{ "seller_user_id": "uuid" }
➡️ Sätter automatiskt status till assigned

Uppdatera status / betalning
PATCH /api/admin/bookings/:id
Exempel:

{
  "status": "won",
  "payment_status": "paid_on_site"
}
Filuppladdning:

Admin använder samma endpoint som säljare men har alltid access.

7. Filhantering
Alla filer lagras i Supabase Storage

Bucket: booking-files

Bucket är private

Metadata sparas i booking_files

Frontend:

Får endast använda backend-URL:er

Får aldrig bygga public URLs själv

8. UX-krav
Ingen sida får krascha vid 401/403

Tydliga felmeddelanden

Loading-states på alla API-anrop

Mobil-först för säljvy

Desktop-optimerad adminvy

9. Absoluta förbud
AI får INTE:

Skapa nya endpoints

Ändra backend-logik

Hoppa över auth

Visa data utan API-svar

Lagra JWT osäkert

Gissa roller

10. Framtida (implementera ej nu)
AI-analys av offerter

Kundportal

Betalningsintegration

11. Slutregel
Om något är oklart:

Stoppa och fråga istället för att anta.

Backend är korrekt byggd.

Frontendens enda uppgift är att:

koppla rätt

visa rätt

aldrig bryta säkerheten