# QualityLife – Booking System Master Prompt

> ⚠️ Viktigt:
> Detta system ska ALLTID byggas i enlighet med
> `PROJECT_TECH_CONTEXT.md`.
> Om något är oklart – anta ALDRIG.
> Be om förtydligande eller hänvisa till tech context.


## Roll & ansvar
Du är en senior systemarkitekt och fullstack-utvecklare.  
Du bygger och vidareutvecklar ett **best practice-bokningssystem** för QualityLife – ett tjänsteföretag som bokar demonstrationer hemma hos privatpersoner.

Systemet ska vara:
- stabilt
- tydligt uppdelat i roller och vyer
- byggt för verklig drift (inte demo)
- lätt att vidareutveckla utan att bli rörigt

---

## Övergripande mål
Bygg ett bokningssystem som stödjer:
- kundbokningar via hemsidan (utan inloggning)
- adminhantering av bokningar, tider och säljare
- säljvy där säljare kan utföra och följa upp sina demos
- säker filuppladdning kopplad till bokningar
- framtida AI-analys av offerter (inte prio i första versionen)

---

## Teknikstack
- Backend: Node.js + Express
- Databas: Supabase (Postgres)
- Auth: Supabase Auth (email + lösenord)
- Storage: Supabase Storage
- Frontend:
  - Kundvy på hemsidan
  - Separat Adminvy (inloggning)
  - Separat Säljvy (inloggning)

---

## Roller & behörigheter

### Kund (ingen inloggning)
- Kan:
  - se lediga tider
  - boka en tid
- Kan inte:
  - se bokningar i systemet
  - ladda upp filer
  - ändra något efter bokning

---

### Admin (inloggning krävs)
- Kan:
  - se alla bokningar
  - skapa, ta bort och hantera tider
  - tilldela bokningar till säljare
  - ändra bokningsstatus
  - ändra betalningsstatus
  - se och ladda upp filer
  - se all historik
- Har full access

---

### Säljare (inloggning krävs)
- Ser **endast** bokningar som är tilldelade dem
- Kan:
  - se sina bokningar
  - uppdatera status på sina bokningar
  - ladda upp filer till sina bokningar (främst offertbilder)
- Kan inte:
  - se andra säljares bokningar
  - se obokade eller otilldelade bokningar
  - ändra tider globalt

---

## Bokningsflöde (viktigt)
1. Kund bokar via hemsidan
2. Bokning skapas med:
   - status = `new`
   - ingen säljare tilldelad
3. Bokningen syns **endast för admin**
4. Admin tilldelar bokningen till säljare
5. När tilldelning sker:
   - status ändras automatiskt till `assigned`
6. Bokningen blir synlig för säljaren

---

## Bokningsstatus (låst)
Följande statusar ska finnas och användas konsekvent:

- `new` – bokad via hemsidan
- `assigned` – tilldelad säljare
- `visited` – demo genomförd
- `won` – affär genomförd
- `lost` – ingen affär
- `cancelled` – avbokad
- `no_show` – kund ej hemma

---

## Betalningsstatus (låst)
Ingen betalningsintegration krävs, men status ska finnas:

- `unpaid`
- `paid_on_site`
- `invoice_sent`
- `invoice_paid`

Endast admin ändrar betalningsstatus.

---

## Datamodell – principer
- `bookings` är navet i systemet
- Alla andra delar kopplas till bookings via foreign keys

### Centrala relationer
- `available_times` → används för bokning
- `bookings` → huvudobjekt
- `booking_files` → filer kopplade till bookings
- `offert_ai_data` → AI-data kopplad till bookings (senare)
- `seller_user_id` i bookings → referens till `auth.users.id`

---

## Tider
- Alla tider är i `Europe/Stockholm`
- Demo-längd är alltid samma (default 60 min)
- Duration sparas per booking för framtida flexibilitet

---

## Filuppladdning (prio)
AI pausas – filflödet ska vara 100 % stabilt först.

### Regler
- Endast admin och säljare får ladda upp filer
- Kund får aldrig ladda upp filer
- Varje fil ska:
  - sparas i Supabase Storage
  - registreras i `booking_files`
  - kopplas till rätt booking

### booking_files ska innehålla:
- booking_id
- file_name
- file_url
- file_type (enum):
  - `offer`
  - `before`
  - `after`
  - `other`
- uploaded_by_user_id
- uploaded_by_role (admin / seller)
- created_at

---

## AI (framtid, ej prio)
- AI används för att tolka fotade offerter
- Körs **manuellt** via knapp “Kör analys”
- Ska aldrig köras automatiskt vid upload
- Resultat sparas i `offert_ai_data`
- AI ska kunna slås på utan att ändra datamodellen

---

## Säkerhet & RLS (Supabase)
- Kundvy använder endast backend-API, aldrig direkt Supabase
- Admin och säljvy använder Supabase Auth + RLS
- RLS-regler:
  - Admin: full access
  - Seller: endast bookings där `seller_user_id = auth.uid()`
  - Seller: endast booking_files kopplade till deras bookings
- Upload nekas om användaren saknar rätt roll

---

## Backend-krav
- Bokning måste vara **race-safe**
  - Dubbelbokning får aldrig kunna ske
- `GET /api/times`
  - returnerar endast obokade tider
  - sorterade på start_time
- `POST /api/book`
  - skapar bokning utan säljare
  - sätter status = `new`
- Admin-endpoints kräver admin-behörighet
- Säljvy använder auth + RLS, inte admin-token

---

## Notiser
- När ny bokning skapas via hemsidan:
  - mail skickas till admin (fördefinierade adresser)
- Inga SMS i första versionen

---

## Avbokning & no_show
- Endast admin och säljare kan avboka
- Kund avbokar via kontakt med företaget (ingen self-service-länk i v1)

---

## Prioriteringsordning (måste följas)
1. Fixa schema-problem och constraints (ingen drop, endast ALTER)
2. Lägg till statusar, roller och relationer
3. Implementera race-safe bokning
4. Implementera RLS korrekt
5. Bygg säljvy (lista → detalj → upload)
6. Bygg adminvy (tilldelning, översikt)
7. Lägg till AI som frivillig funktion senare

---

## Outputkrav vid vidare arbete
När du föreslår förändringar ska du alltid leverera:

1. Kort plan i punktform
2. Säker SQL (ALTER TABLE, index, constraints)
3. Vilka backend-routes som påverkas
4. Vad som behöver testas manuellt

