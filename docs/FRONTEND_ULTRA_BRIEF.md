# Frontend Ultra Brief – QualityLife Booking

Syfte
Bygg en enkel, snabb och säker frontend som kopplar mot vår befintliga backend på Render och använder Supabase Auth för admin och säljare.

Teknikval
Frontend byggs i befintliga 11ty-projektet.
Ingen separat frontend-app i första versionen.
All interaktivitet görs med små JS-moduler (”JS islands”) i 11ty.

Miljöer
Backend Base URL:
https://ql-hemsida.onrender.com

Supabase Project URL:
https://joynmufuivwwyhfnbeae.supabase.co

Roller
Kund: ingen inloggning.
Säljare: Supabase Auth, ser endast tilldelade bokningar.
Admin: Supabase Auth, ser allt och kan tilldela.

Sidor som ska byggas (MVP)
1. /boka
Visar tider från GET /api/times och bokningsform som POST /api/book.

2. /seller/login
Inloggning via Supabase Auth.
Efter login: redirect till /seller

3. /seller
Lista: GET /api/seller/my-bookings

4. /seller/bookings/:id
Detaljvy: GET /api/seller/bookings/:id
Status: PATCH /api/seller/bookings/:id/status
Filuppladdning: POST /api/seller/bookings/:id/files (form-data)

5. /admin/login
Inloggning via Supabase Auth.
Efter login: redirect till /admin

6. /admin
Lista: GET /api/admin/bookings
Lista säljare: GET /api/admin/sellers
Tilldela: PATCH /api/admin/bookings/:id/assign
Ändra status/betalning: PATCH /api/admin/bookings/:id

Behov för UI
Tydliga felmeddelanden
Loading-states på alla anrop
Mobil-first för seller
Desktop för admin

Säkerhet
JWT lagras endast i sessionStorage (MVP).
Alla skyddade requests skickar Authorization: Bearer <JWT>.
Vid 401/403: redirect till login.

Definition of Done (MVP)
Kund kan boka en tid och får tydlig bekräftelse.
Admin kan logga in och se bokningar, tilldela en säljare.
Säljare kan logga in, se sina bokningar, öppna detaljvy och ladda upp en offertbild.
Uppladdad fil syns i booking_files och i Supabase Storage.
