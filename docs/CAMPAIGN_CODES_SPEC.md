# Campaign Codes Spec
## QualityLife Booking System (Source of Truth)

Syfte
Lägga till en kampanjkodsfunktion som ger 50% rabatt på ordinarie pris för mattvätt.
Admin ska kunna skapa, aktivera och inaktivera kampanjkoder.
Kampanjkoder kan vara globala eller kopplade till en specifik säljare.

Denna funktion får inte bryta race safe bokning.
Backend är alltid källa till sanning för pris, validering och tillämpning av kampanjkod.

## 1. Prisregler (låst)

Tjänst: mattvätt
Ordinarie pris: 1500 SEK
Kampanjkod: 50% rabatt
Pris med kod: 750 SEK

Backend räknar alltid ut priset och returnerar base_price_sek och final_price_sek.
Frontend får visa pris men får aldrig räkna pris som källa till sanning.

## 2. Data som måste sparas på bokningen

När en bokning skapas sparas alltid:
base_price_sek
discount_percent
final_price_sek
promo_code (normaliserad)
promo_code_id (om giltig kod användes)

Detta gör att historik blir korrekt även om koder senare inaktiveras.

## 3. Kampanjkodsregler

En kod är giltig om:
active = true
starts_at är null eller now >= starts_at
ends_at är null eller now <= ends_at
usage_limit är null eller usage_count < usage_limit

Seller bindning:
Om promo_codes.seller_user_id inte är null gäller koden endast när bokningen har samma seller_user_id.
Om bokningen saknar seller_user_id ska seller bundna koder inte gälla.

Normalisering:
promo_code trimmas och uppercasas.
Exempel: " test50 " blir "TEST50".

## 4. Databas

Ny tabell: promo_codes

Minimala fält:
id uuid pk
code text unique
seller_user_id uuid nullable references auth.users(id)
discount_percent int default 50
active bool default true
starts_at timestamptz nullable
ends_at timestamptz nullable
usage_limit int nullable
usage_count int default 0
created_by uuid nullable references auth.users(id)
created_at timestamptz default now()
notes text nullable

Rekommenderade index:
unique index på code
index på seller_user_id
index på active

Bokningstabellen ska få fält:
base_price_sek int
discount_percent int
final_price_sek int
promo_code text
promo_code_id uuid references promo_codes(id)

## 5. Backend logik

Backend ska ha en ren funktion som:
validatePromoCode(code, seller_user_id)
returnerar:
valid bool
reason string om invalid
discount_percent int
promo_code_id uuid om valid

Tillämpning i bokning:
POST /api/book ska acceptera promo_code som optional i body.
Backend ska alltid:
1) validera promo_code server side
2) räkna pris
3) spara prisfält på bokningen
4) om kod är giltig och usage_limit finns ska usage_count ökas race safe

Race safe krav:
Increment av usage_count måste vara atomär.
Exempel:
update promo_codes set usage_count = usage_count + 1 where id = x and (usage_limit is null or usage_count < usage_limit)

Om update påverkar 0 rader betyder det att limit nåddes, behandla som invalid.

## 6. API ändringar

Publik bokning
POST /api/book

Utöka request body:
promo_code string optional
seller_user_id uuid optional

Exempel:
{
  "time_id": "...",
  "name": "...",
  "address": "...",
  "phone": "...",
  "email": "...",
  "promo_code": "TEST50",
  "seller_user_id": "uuid optional"
}

Response ska inkludera:
base_price_sek
discount_percent
final_price_sek
promo_code om giltig annars null
promo_code_valid bool
promo_code_reason om invalid annars null

Admin CRUD kampanjkoder
Nya admin endpoints:
GET /api/admin/promo-codes
POST /api/admin/promo-codes
PATCH /api/admin/promo-codes/:id

Skapa kod payload:
{
  "code": "TEST50",
  "seller_user_id": null,
  "active": true,
  "starts_at": null,
  "ends_at": null,
  "usage_limit": null,
  "notes": "Prova på"
}

Admin ska kunna inaktivera genom PATCH active false.

Seller view (valfritt men rekommenderat)
GET /api/seller/promo-codes
Returnera endast koder där seller_user_id = auth.uid()

## 7. Acceptanskriterier

1) Admin kan skapa en kod och koppla den till en säljare.
2) POST /api/book med giltig kod ger final_price_sek 750.
3) POST /api/book med ogiltig kod ger final_price_sek 1500 och promo_code_valid false.
4) Seller bundna koder fungerar bara när seller_user_id matchar.
5) usage_limit fungerar och kan inte övertrasseras vid samtidiga bokningar.
6) Prisfält sparas alltid på bokningen.
