# Decisions – QualityLife Booking System

Detta dokument innehåller ALLA beslut som är fattade för bokningssystemet.
Detta är source of truth.

Om något här motsägs av kod, prompt eller förslag:
→ koden eller förslaget är FEL och ska justeras.

Uppdatera detta dokument när nya beslut tas.

---

## Övergripande mål
- Bygga ett stabilt, professionellt bokningssystem för demonstrationer hemma hos privatpersoner
- Systemet ska fungera i verklig drift, inte bara som demo
- Fokus på tydlig struktur, säkerhet och möjlighet att växa

---

## Teknik & Deployment (låst)
- Backend: Node.js + Express
- Databas: Supabase Postgres
- Auth: Supabase Auth (email + lösenord)
- Storage: Supabase Storage
- Hosting: Render
- Deployment: Automatisk deploy från GitHub → Render
- `main` branch = produktionsbranch
- All config via environment variables
- Inga manuella deployer

---

## Vyer & Roller (låst)

### Kundvy
- Ingen inloggning
- Kan:
  - se lediga tider
  - boka tid
- Kan inte:
  - se bokningar i systemet
  - ladda upp filer
  - ändra bokning själv

### Adminvy
- Inloggning krävs
- Ser ALLA bokningar
- Kan:
  - skapa och ta bort tider
  - tilldela bokningar till säljare
  - ändra bokningsstatus
  - ändra betalningsstatus
  - se och ladda upp filer
  - se historik och detaljer

### Säljvy
- Inloggning krävs
- Säljare ser ENDAST bokningar som är tilldelade dem
- Kan:
  - se sina bokningar
  - uppdatera status på sina bokningar
  - ladda upp filer (framför allt offertbilder)
- Kan inte:
  - se andra säljares bokningar
  - se otilldelade bokningar

---

## Bokningsflöde (låst)
1. Kund bokar via hemsidan
2. Bokning skapas med:
   - status = `new`
   - ingen säljare tilldelad
3. Bokningen syns endast för admin
4. Admin tilldelar bokningen till säljare
5. Vid tilldelning:
   - status ändras automatiskt till `assigned`
6. Bokningen blir synlig för säljaren

---

## Bokningsstatus (låst)
Följande statusar används:

- new
- assigned
- visited
- won
- lost
- cancelled
- no_show

---

## Betalningsstatus (låst)
Ingen betalningsintegration i v1, men status ska finnas:

- unpaid
- paid_on_site
- invoice_sent
- invoice_paid

Endast admin får ändra betalningsstatus.

---

## Datamodell – grundprinciper (låst)
- `bookings` är navet i systemet
- All data kopplas till bookings via foreign keys
- Bokning kan existera utan säljare
- Säljare kopplas via `seller_user_id` → `auth.users.id`

---

## Tider (låst)
- Alla tider är i timezone: `Europe/Stockholm`
- Alla demos har samma längd (default 60 min)
- Duration sparas per booking för framtida flexibilitet

---

## Filuppladdning (låst)
- Endast admin och säljare får ladda upp filer
- Kund får aldrig ladda upp filer
- Alla filer:
  - lagras i Supabase Storage
  - kopplas till rätt booking
  - registreras i `booking_files`

### Tillåtna filtyper
- offer
- before
- after
- other

### Metadata som ska sparas per fil
- booking_id
- file_name
- file_url
- file_type
- uploaded_by_user_id
- uploaded_by_role
- created_at

---

## AI (beslut just nu)
- AI är PAUSAD
- Fokus är stabil filuppladdning först
- AI ska:
  - köras manuellt via knapp
  - aldrig köras automatiskt
- AI ska kunna läggas till senare utan att ändra datamodellen

---

## Notiser (låst)
- När ny bokning skapas via hemsidan:
  - mail skickas till admin
- Inga SMS i v1

---

## Avbokning & no_show (låst)
- Endast admin och säljare kan avboka
- Kund avbokar via kontakt med företaget
- Ingen self-service-avbokning i v1

---

## Säkerhet (låst)
- Kundvy pratar endast med backend
- Kundvy får aldrig prata direkt med Supabase
- Admin och säljvy använder Supabase Auth + RLS
- Service role key används endast i backend

---

## Prioriteringsordning (låst)
1. Fixa schema-problem och constraints
2. Lägg till statusar och roller
3. Gör bokning race-safe
4. Implementera RLS
5. Bygg säljvy
6. Bygg adminvy
7. Lägg till AI senare

---

## Hur detta dokument används
- Uppdateras när beslut tas
- Delas alltid med AI eller utvecklare
- Ersätter muntliga förklaringar

