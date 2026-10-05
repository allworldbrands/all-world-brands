const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const SITE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "database.db");

/*
 * Payment modes:
 *
 * demo = local/server demo acquiring flow
 * bank = future real bank acquiring integration
 *
 * IMPORTANT:
 * The browser must never be trusted to mark an application as paid.
 */
const PAYMENT_MODE =
    String(process.env.PAYMENT_MODE || "demo").toLowerCase();

const DEMO_PAYMENT_ENABLED =
    String(process.env.DEMO_PAYMENT_ENABLED || "true").toLowerCase() === "true";

const APPLICATION_AMOUNT = 1;
const APPLICATION_CURRENCY = "USD";

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(
        path.join(__dirname, "public"),
        {
            extensions: ["html"]
        }
    )
);

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");


/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo TEXT,
    website TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(country_id)
        REFERENCES countries(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    brand_id INTEGER,
    country_id INTEGER,

    name TEXT NOT NULL,
    comment TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(brand_id)
        REFERENCES brands(id)
        ON DELETE CASCADE,

    FOREIGN KEY(country_id)
        REFERENCES countries(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS brand_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    country_id INTEGER NOT NULL,

    brand_name TEXT NOT NULL,
    logo TEXT,
    website TEXT,
    description TEXT,

    contact_name TEXT,
    contact_phone TEXT,

    amount REAL NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',

    payment_status TEXT NOT NULL DEFAULT 'unpaid',

    payment_reference TEXT,
    payment_provider TEXT,
    payment_session_id TEXT,

    paid_at DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(country_id)
        REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS payment_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    application_id INTEGER NOT NULL,

    session_id TEXT NOT NULL UNIQUE,

    provider TEXT NOT NULL,

    amount REAL NOT NULL,
    currency TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'created',

    provider_reference TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    FOREIGN KEY(application_id)
        REFERENCES brand_applications(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brands_country
ON brands(country_id);

CREATE INDEX IF NOT EXISTS idx_brands_name
ON brands(name);

CREATE INDEX IF NOT EXISTS idx_comments_brand
ON comments(brand_id);

CREATE INDEX IF NOT EXISTS idx_comments_country
ON comments(country_id);

CREATE INDEX IF NOT EXISTS idx_applications_payment
ON brand_applications(payment_status);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_application
ON payment_sessions(application_id);
`);


/* =========================================================
   HELPERS
========================================================= */

function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function makeUniqueSlug(table, value, id = null) {

    const base =
        slugify(value) ||
        crypto.randomUUID();

    let candidate = base;
    let counter = 2;

    while (true) {

        let row;

        if (table === "countries") {

            row = id
                ? db.prepare(`
                    SELECT id
                    FROM countries
                    WHERE slug = ?
                    AND id != ?
                `).get(candidate, id)
                : db.prepare(`
                    SELECT id
                    FROM countries
                    WHERE slug = ?
                `).get(candidate);

        } else {

            row = id
                ? db.prepare(`
                    SELECT id
                    FROM brands
                    WHERE slug = ?
                    AND id != ?
                `).get(candidate, id)
                : db.prepare(`
                    SELECT id
                    FROM brands
                    WHERE slug = ?
                `).get(candidate);
        }

        if (!row) {
            return candidate;
        }

        candidate = `${base}-${counter++}`;
    }
}

function safeUrl(value) {

    if (!value) {
        return "";
    }

    try {

        const url = new URL(String(value).trim());

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return "";
        }

        return url.toString();

    } catch {
        return "";
    }
}

function flagFromCode(code) {

    if (!/^[A-Z]{2}$/.test(code)) {
        return "";
    }

    return code
        .split("")
        .map(
            char =>
                String.fromCodePoint(
                    127397 + char.charCodeAt(0)
                )
        )
        .join("");
}

function normalizeText(value, maxLength) {

    return String(value || "")
        .trim()
        .slice(0, maxLength);
}


/* =========================================================
   BASIC CONTENT MODERATION
========================================================= */

const BLOCKED_CONTENT = [
    "porn",
    "pornography",
    "xxx",
    "sex video",
    "sexual services",
    "escort service",
    "child sexual",
    "csam"
];

function containsBlockedContent(value) {

    const text =
        String(value || "")
            .toLowerCase()
            .replace(/\s+/g, " ");

    return BLOCKED_CONTENT.some(
        word => text.includes(word)
    );
}


/* =========================================================
   ISO 3166-1 COUNTRIES AND TERRITORIES
   249 CURRENT ISO COUNTRY/TERRITORY ENTRIES
========================================================= */

const ISO_COUNTRIES = `
AF|Afghanistan
AX|Åland Islands
AL|Albania
DZ|Algeria
AS|American Samoa
AD|Andorra
AO|Angola
AI|Anguilla
AQ|Antarctica
AG|Antigua and Barbuda
AR|Argentina
AM|Armenia
AW|Aruba
AU|Australia
AT|Austria
AZ|Azerbaijan
BS|Bahamas
BH|Bahrain
BD|Bangladesh
BB|Barbados
BY|Belarus
BE|Belgium
BZ|Belize
BJ|Benin
BM|Bermuda
BT|Bhutan
BO|Bolivia
BQ|Bonaire, Sint Eustatius and Saba
BA|Bosnia and Herzegovina
BW|Botswana
BV|Bouvet Island
BR|Brazil
IO|British Indian Ocean Territory
BN|Brunei
BG|Bulgaria
BF|Burkina Faso
BI|Burundi
CV|Cabo Verde
KH|Cambodia
CM|Cameroon
CA|Canada
KY|Cayman Islands
CF|Central African Republic
TD|Chad
CL|Chile
CN|China
CX|Christmas Island
CC|Cocos (Keeling) Islands
CO|Colombia
KM|Comoros
CG|Congo
CD|Congo, Democratic Republic of the
CK|Cook Islands
CR|Costa Rica
CI|Côte d'Ivoire
HR|Croatia
CU|Cuba
CW|Curaçao
CY|Cyprus
CZ|Czechia
DK|Denmark
DJ|Djibouti
DM|Dominica
DO|Dominican Republic
EC|Ecuador
EG|Egypt
SV|El Salvador
GQ|Equatorial Guinea
ER|Eritrea
EE|Estonia
SZ|Eswatini
ET|Ethiopia
FK|Falkland Islands
FO|Faroe Islands
FJ|Fiji
FI|Finland
FR|France
GF|French Guiana
PF|French Polynesia
TF|French Southern Territories
GA|Gabon
GM|Gambia
GE|Georgia
DE|Germany
GH|Ghana
GI|Gibraltar
GR|Greece
GL|Greenland
GD|Grenada
GP|Guadeloupe
GU|Guam
GT|Guatemala
GG|Guernsey
GN|Guinea
GW|Guinea-Bissau
GY|Guyana
HT|Haiti
HM|Heard Island and McDonald Islands
VA|Holy See
HN|Honduras
HK|Hong Kong
HU|Hungary
IS|Iceland
IN|India
ID|Indonesia
IR|Iran
IQ|Iraq
IE|Ireland
IM|Isle of Man
IL|Israel
IT|Italy
JM|Jamaica
JP|Japan
JE|Jersey
JO|Jordan
KZ|Kazakhstan
KE|Kenya
KI|Kiribati
KP|North Korea
KR|South Korea
KW|Kuwait
KG|Kyrgyzstan
LA|Laos
LV|Latvia
LB|Lebanon
LS|Lesotho
LR|Liberia
LY|Libya
LI|Liechtenstein
LT|Lithuania
LU|Luxembourg
MO|Macao
MG|Madagascar
MW|Malawi
MY|Malaysia
MV|Maldives
ML|Mali
MT|Malta
MH|Marshall Islands
MQ|Martinique
MR|Mauritania
MU|Mauritius
YT|Mayotte
MX|Mexico
FM|Micronesia
MD|Moldova
MC|Monaco
MN|Mongolia
ME|Montenegro
MS|Montserrat
MA|Morocco
MZ|Mozambique
MM|Myanmar
NA|Namibia
NR|Nauru
NP|Nepal
NL|Netherlands
NC|New Caledonia
NZ|New Zealand
NI|Nicaragua
NE|Niger
NG|Nigeria
NU|Niue
NF|Norfolk Island
MK|North Macedonia
MP|Northern Mariana Islands
NO|Norway
OM|Oman
PK|Pakistan
PW|Palau
PS|Palestine
PA|Panama
PG|Papua New Guinea
PY|Paraguay
PE|Peru
PH|Philippines
PN|Pitcairn
PL|Poland
PT|Portugal
PR|Puerto Rico
QA|Qatar
RE|Réunion
RO|Romania
RU|Russia
RW|Rwanda
BL|Saint Barthélemy
SH|Saint Helena
KN|Saint Kitts and Nevis
LC|Saint Lucia
MF|Saint Martin
PM|Saint Pierre and Miquelon
VC|Saint Vincent and the Grenadines
WS|Samoa
SM|San Marino
ST|Sao Tome and Principe
SA|Saudi Arabia
SN|Senegal
RS|Serbia
SC|Seychelles
SL|Sierra Leone
SG|Singapore
SX|Sint Maarten
SK|Slovakia
SI|Slovenia
SB|Solomon Islands
SO|Somalia
ZA|South Africa
GS|South Georgia and the South Sandwich Islands
SS|South Sudan
ES|Spain
LK|Sri Lanka
SD|Sudan
SR|Suriname
SJ|Svalbard and Jan Mayen
SE|Sweden
CH|Switzerland
SY|Syria
TW|Taiwan
TJ|Tajikistan
TZ|Tanzania
TH|Thailand
TL|Timor-Leste
TG|Togo
TK|Tokelau
TO|Tonga
TT|Trinidad and Tobago
TN|Tunisia
TR|Türkiye
TM|Turkmenistan
TC|Turks and Caicos Islands
TV|Tuvalu
UG|Uganda
UA|Ukraine
AE|United Arab Emirates
GB|United Kingdom
US|United States
UM|United States Minor Outlying Islands
UY|Uruguay
UZ|Uzbekistan
VU|Vanuatu
VE|Venezuela
VN|Vietnam
VG|Virgin Islands, British
VI|Virgin Islands, U.S.
WF|Wallis and Futuna
EH|Western Sahara
YE|Yemen
ZM|Zambia
ZW|Zimbabwe
`.trim()
    .split("\n")
    .map(line => {

        const [code, name] =
            line.split("|");

        return {
            code,
            name
        };

    });


/* =========================================================
   SEED COUNTRIES
========================================================= */

const insertCountry =
    db.prepare(`
        INSERT OR IGNORE INTO countries
        (name, code, slug)
        VALUES (?, ?, ?)
    `);

const seedCountries =
    db.transaction(() => {

        for (const country of ISO_COUNTRIES) {

            insertCountry.run(
                country.name,
                country.code,
                slugify(country.name)
            );

        }

    });

seedCountries();


/* =========================================================
   API — HEALTH
========================================================= */

app.get("/api/health", (req, res) => {

    const countryCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM countries
        `).get().count;

    const brandCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM brands
        `).get().count;

    const applicationCount =
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM brand_applications
        `).get().count;

    res.json({
        ok: true,
        site: "ALL WORLD BRANDS",
        language: "English",
        payment_mode: PAYMENT_MODE,
        application_fee: APPLICATION_AMOUNT,
        currency: APPLICATION_CURRENCY,
        countries: countryCount,
        expected_iso_countries: ISO_COUNTRIES.length,
        brands: brandCount,
        applications: applicationCount
    });
});


/* =========================================================
   API — COUNTRIES
========================================================= */

app.get("/api/countries", (req, res) => {

    const rows =
        db.prepare(`
            SELECT
                c.id,
                c.name,
                c.code,
                COUNT(b.id) AS brand_count
            FROM countries c
            LEFT JOIN brands b
                ON b.country_id = c.id
            GROUP BY c.id
            ORDER BY c.name COLLATE NOCASE
        `).all();

    const result =
        rows.map(row => ({
            ...row,
            flag: flagFromCode(row.code)
        }));

    res.json(result);
});


/* =========================================================
   API — COUNTRY
========================================================= */

app.get("/api/countries/:id", (req, res) => {

    const country =
        db.prepare(`
            SELECT
                id,
                name,
                code
            FROM countries
            WHERE id = ?
        `).get(req.params.id);

    if (!country) {

        return res.status(404).json({
            error: "Country not found"
        });

    }

    res.json({
        ...country,
        flag: flagFromCode(country.code)
    });
});


/* =========================================================
   API — COUNTRY BRANDS
========================================================= */

app.get(
    "/api/countries/:id/brands",
    (req, res) => {

        const country =
            db.prepare(`
                SELECT
                    id,
                    name,
                    code
                FROM countries
                WHERE id = ?
            `).get(req.params.id);

        if (!country) {

            return res.status(404).json({
                error: "Country not found"
            });

        }

        const brands =
            db.prepare(`
                SELECT
                    id,
                    country_id,
                    name,
                    slug,
                    logo,
                    website,
                    description,
                    created_at
                FROM brands
                WHERE country_id = ?
                ORDER BY name COLLATE NOCASE
            `).all(country.id);

        res.json({
            country: {
                ...country,
                flag: flagFromCode(country.code)
            },
            brands
        });
    }
);


/* =========================================================
   API — BRAND
========================================================= */

app.get(
    "/api/brands/:id",
    (req, res) => {

        const brand =
            db.prepare(`
                SELECT
                    b.*,
                    c.name AS country_name,
                    c.code AS country_code
                FROM brands b
                JOIN countries c
                    ON c.id = b.country_id
                WHERE b.id = ?
            `).get(req.params.id);

        if (!brand) {

            return res.status(404).json({
                error: "Brand not found"
            });

        }

        const comments =
            db.prepare(`
                SELECT
                    id,
                    name,
                    comment,
                    created_at
                FROM comments
                WHERE brand_id = ?
                ORDER BY created_at DESC
            `).all(brand.id);

        res.json({
            brand: {
                ...brand,
                country_flag:
                    flagFromCode(brand.country_code)
            },
            comments
        });
    }
);


/* =========================================================
   API — SEARCH
========================================================= */

app.get("/api/search", (req, res) => {

    const q =
        normalizeText(req.query.q, 100);

    if (!q) {
        return res.json([]);
    }

    const like = `%${q}%`;

    const rows =
        db.prepare(`
            SELECT
                b.id,
                b.name,
                b.logo,
                b.slug,

                c.id AS country_id,
                c.name AS country_name,
                c.code AS country_code

            FROM brands b

            JOIN countries c
                ON c.id = b.country_id

            WHERE
                b.name LIKE ?
                OR c.name LIKE ?

            ORDER BY
                b.name COLLATE NOCASE

            LIMIT 100
        `).all(like, like);

    res.json(
        rows.map(row => ({
            ...row,
            country_flag:
                flagFromCode(row.country_code)
        }))
    );
});


/* =========================================================
   COMMENTS
========================================================= */

app.post("/api/comments", (req, res) => {

    const name =
        normalizeText(req.body.name, 80);

    const comment =
        normalizeText(req.body.comment, 1000);

    const brandId =
        req.body.brand_id
            ? Number(req.body.brand_id)
            : null;

    const countryId =
        req.body.country_id
            ? Number(req.body.country_id)
            : null;

    if (!name || !comment) {

        return res.status(400).json({
            error: "Name and comment are required."
        });

    }

    if (containsBlockedContent(name + " " + comment)) {

        return res.status(400).json({
            error: "This content is not allowed."
        });

    }

    if (!brandId && !countryId) {

        return res.status(400).json({
            error: "Brand or country is required."
        });

    }

    if (brandId) {

        const brand =
            db.prepare(`
                SELECT id
                FROM brands
                WHERE id = ?
            `).get(brandId);

        if (!brand) {

            return res.status(404).json({
                error: "Brand not found."
            });

        }
    }

    if (countryId) {

        const country =
            db.prepare(`
                SELECT id
                FROM countries
                WHERE id = ?
            `).get(countryId);

        if (!country) {

            return res.status(404).json({
                error: "Country not found."
            });

        }
    }

    const result =
        db.prepare(`
            INSERT INTO comments
            (
                brand_id,
                country_id,
                name,
                comment
            )
            VALUES (?, ?, ?, ?)
        `).run(
            brandId,
            countryId,
            name,
            comment
        );

    res.status(201).json({
        success: true,
        id: result.lastInsertRowid
    });
});


/* =========================================================
   BRAND APPLICATION
   $1 USD
========================================================= */

app.post(
    "/api/brand-applications",
    (req, res) => {

        const countryId =
            Number(req.body.country_id);

        const brandName =
            normalizeText(
                req.body.brand_name,
                150
            );

        const logo =
            safeUrl(req.body.logo);

        const website =
            safeUrl(req.body.website);

        const description =
            normalizeText(
                req.body.description,
                3000
            );

        const contactName =
            normalizeText(
                req.body.contact_name,
                120
            );

        const contactPhone =
            normalizeText(
                req.body.contact_phone,
                40
            );

        if (!countryId || !brandName) {

            return res.status(400).json({
                error:
                    "Country and brand name are required."
            });

        }

        if (
            containsBlockedContent(
                brandName +
                " " +
                description
            )
        ) {

            return res.status(400).json({
                error:
                    "This application contains prohibited content."
            });

        }

        const country =
            db.prepare(`
                SELECT id
                FROM countries
                WHERE id = ?
            `).get(countryId);

        if (!country) {

            return res.status(404).json({
                error: "Country not found."
            });

        }

        /*
         * IMPORTANT:
         *
         * The amount and payment status are controlled
         * by the SERVER.
         *
         * The browser cannot choose:
         *
         * payment_status = paid
         *
         * or:
         *
         * amount = 0
         */

        const result =
            db.prepare(`
                INSERT INTO brand_applications
                (
                    country_id,
                    brand_name,
                    logo,
                    website,
                    description,
                    contact_name,
                    contact_phone,
                    amount,
                    currency,
                    payment_status
                )
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
            `).run(
                countryId,
                brandName,
                logo,
                website,
                description,
                contactName,
                contactPhone,
                APPLICATION_AMOUNT,
                APPLICATION_CURRENCY
            );

        res.status(201).json({
            success: true,

            application_id:
                Number(result.lastInsertRowid),

            amount:
                APPLICATION_AMOUNT,

            currency:
                APPLICATION_CURRENCY,

            payment_status:
                "unpaid",

            message:
                "Application created. Payment is required."
        });
    }
);


/* =========================================================
   PAYMENT — CREATE SESSION
========================================================= */

app.post(
    "/api/payments/create",
    (req, res) => {

        const applicationId =
            Number(req.body.application_id);

        if (!applicationId) {

            return res.status(400).json({
                error:
                    "Application ID is required."
            });

        }

        const application =
            db.prepare(`
                SELECT
                    id,
                    amount,
                    currency,
                    payment_status
                FROM brand_applications
                WHERE id = ?
            `).get(applicationId);

        if (!application) {

            return res.status(404).json({
                error:
                    "Application not found."
            });

        }

        if (
            application.payment_status === "paid"
        ) {

            return res.json({
                success: true,
                already_paid: true,
                application_id:
                    application.id
            });

        }

        const sessionId =
            crypto.randomUUID();

        db.prepare(`
            INSERT INTO payment_sessions
            (
                application_id,
                session_id,
                provider,
                amount,
                currency,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'created')
        `).run(
            application.id,
            sessionId,
            PAYMENT_MODE === "bank"
                ? "bank_acquiring"
                : "demo_bank_acquiring",
            application.amount,
            application.currency
        );

        /*
         * DEMO MODE
         *
         * The returned URL simulates the future bank
         * payment page.
         *
         * Later this URL will be replaced with the
         * real bank acquiring URL.
         */

        const paymentUrl =
            `${SITE_URL}/payment/demo/${encodeURIComponent(sessionId)}`;

        res.json({
            success: true,
            payment_session_id: sessionId,
            provider:
                PAYMENT_MODE === "bank"
                    ? "bank_acquiring"
                    : "demo_bank_acquiring",
            amount: application.amount,
            currency: application.currency,
            payment_url: paymentUrl
        });
    }
);


/* =========================================================
   DEMO PAYMENT PAGE
========================================================= */

app.get(
    "/payment/demo/:sessionId",
    (req, res) => {

        if (!DEMO_PAYMENT_ENABLED) {

            return res.status(404).send(
                "Demo payment is disabled."
            );

        }

        const session =
            db.prepare(`
                SELECT
                    ps.id,
                    ps.session_id,
                    ps.application_id,
                    ps.amount,
                    ps.currency,
                    ps.status,

                    ba.brand_name
                FROM payment_sessions ps

                JOIN brand_applications ba
                    ON ba.id = ps.application_id

                WHERE ps.session_id = ?
            `).get(req.params.sessionId);

        if (!session) {

            return res.status(404).send(
                "Payment session not found."
            );

        }

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>Demo Payment — ALL WORLD BRANDS</title>

<style>

body {
    margin: 0;
    min-height: 100vh;

    display: flex;
    align-items: center;
    justify-content: center;

    background: #050914;
    color: white;

    font-family:
        Arial,
        Helvetica,
        sans-serif;
}

.card {
    width: min(92%, 430px);

    background: #111827;

    border: 1px solid #293548;

    border-radius: 20px;

    padding: 28px;

    box-sizing: border-box;
}

h1 {
    margin-top: 0;
}

.amount {
    font-size: 36px;
    font-weight: 700;
    margin: 24px 0;
}

button {
    width: 100%;
    border: 0;

    padding: 15px;

    border-radius: 12px;

    font-size: 16px;
    font-weight: 700;

    cursor: pointer;

    margin-top: 12px;
}

.pay {
    background: #22c55e;
    color: #03120a;
}

.cancel {
    background: #374151;
    color: white;
}

.note {
    color: #9ca3af;
    font-size: 13px;
    line-height: 1.5;
    margin-top: 20px;
}

</style>
</head>

<body>

<div class="card">

<h1>Demo Bank Payment</h1>

<p>
ALL WORLD BRANDS
</p>

<p>
Brand application:
<strong>
${String(session.brand_name)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}
</strong>
</p>

<div class="amount">
$${Number(session.amount).toFixed(2)}
</div>

<p>
This is a demonstration payment page.
No real money will be charged.
</p>

<form
method="POST"
action="/api/payments/demo/${encodeURIComponent(session.session_id)}/success"
>

<button class="pay" type="submit">
Complete Demo Payment
</button>

</form>

<form
method="POST"
action="/api/payments/demo/${encodeURIComponent(session.session_id)}/cancel"
>

<button class="cancel" type="submit">
Cancel Payment
</button>

</form>

<div class="note">
Production mode will connect this payment session
to the bank acquiring provider. Payment confirmation
must come from the server/provider, not from the browser.
</div>

</div>

</body>
</html>
`;

        res.type("html").send(html);
    }
);


/* =========================================================
   DEMO PAYMENT — SUCCESS
   SERVER-SIDE ONLY
========================================================= */

app.post(
    "/api/payments/demo/:sessionId/success",
    (req, res) => {

        if (!DEMO_PAYMENT_ENABLED) {

            return res.status(404).send(
                "Demo payment is disabled."
            );

        }

        const session =
            db.prepare(`
                SELECT
                    id,
                    session_id,
                    application_id,
                    amount,
                    currency,
                    status
                FROM payment_sessions
                WHERE session_id = ?
            `).get(req.params.sessionId);

        if (!session) {

            return res.status(404).send(
                "Payment session not found."
            );

        }

        if (session.status === "paid") {

            return res.redirect(
                `/payment/result?status=paid&application_id=${session.application_id}`
            );

        }

        const providerReference =
            `DEMO-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

        const transaction =
            db.transaction(() => {

                db.prepare(`
                    UPDATE payment_sessions
                    SET
                        status = 'paid',
                        provider_reference = ?,
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    providerReference,
                    session.id
                );

                db.prepare(`
                    UPDATE brand_applications
                    SET
                        payment_status = 'paid',
                        payment_reference = ?,
                        payment_provider = 'demo_bank_acquiring',
                        payment_session_id = ?,
                        paid_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    AND payment_status != 'paid'
                `).run(
                    providerReference,
                    session.session_id,
                    session.application_id
                );

            });

        transaction();

        res.redirect(
            `/payment/result?status=paid&application_id=${session.application_id}`
        );
    }
);


/* =========================================================
   DEMO PAYMENT — CANCEL
========================================================= */

app.post(
    "/api/payments/demo/:sessionId/cancel",
    (req, res) => {

        if (!DEMO_PAYMENT_ENABLED) {

            return res.status(404).send(
                "Demo payment is disabled."
            );

        }

        const session =
            db.prepare(`
                SELECT
                    id,
                    application_id
                FROM payment_sessions
                WHERE session_id = ?
            `).get(req.params.sessionId);

        if (!session) {

            return res.status(404).send(
                "Payment session not found."
            );

        }

        db.prepare(`
            UPDATE payment_sessions
            SET status = 'cancelled'
            WHERE id = ?
        `).run(session.id);

        /*
         * IMPORTANT:
         *
         * The application remains UNPAID.
         *
         * This is what allows the frontend to return
         * to the original "Pay $1" state.
         */

        res.redirect(
            `/payment/result?status=cancelled&application_id=${session.application_id}`
        );
    }
);


/* =========================================================
   PAYMENT RESULT
========================================================= */

app.get(
    "/payment/result",
    (req, res) => {

        const status =
            String(req.query.status || "");

        const applicationId =
            Number(req.query.application_id || 0);

        let title =
            "Payment";

        let message =
            "Payment status could not be determined.";

        if (status === "paid") {

            title =
                "Payment Successful";

            message =
                "Your payment has been confirmed by the server.";

        } else if (status === "cancelled") {

            title =
                "Payment Cancelled";

            message =
                "No payment was completed. Your application remains unpaid.";

        }

        res.type("html").send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>${title} — ALL WORLD BRANDS</title>

<style>

body {
    margin: 0;
    min-height: 100vh;

    display: flex;
    align-items: center;
    justify-content: center;

    background: #050914;
    color: white;

    font-family: Arial, Helvetica, sans-serif;
}

.card {
    max-width: 500px;
    margin: 20px;

    padding: 30px;

    border-radius: 20px;

    background: #111827;

    border: 1px solid #293548;
}

a {
    display: inline-block;

    margin-top: 20px;

    color: white;

    background: #2563eb;

    padding: 12px 18px;

    border-radius: 10px;

    text-decoration: none;
}

</style>

</head>

<body>

<div class="card">

<h1>${title}</h1>

<p>${message}</p>

<p>
Application ID:
<strong>${applicationId || "N/A"}</strong>
</p>

<a href="/">
Return to ALL WORLD BRANDS
</a>

</div>

</body>

</html>
`);
    }
);


/* =========================================================
   APPLICATION STATUS
========================================================= */

app.get(
    "/api/brand-applications/:id",
    (req, res) => {

        const application =
            db.prepare(`
                SELECT
                    id,
                    country_id,
                    brand_name,
                    amount,
                    currency,
                    payment_status,
                    payment_reference,
                    payment_provider,
                    paid_at,
                    created_at
                FROM brand_applications
                WHERE id = ?
            `).get(req.params.id);

        if (!application) {

            return res.status(404).json({
                error:
                    "Application not found."
            });

        }

        res.json(application);
    }
);


/* =========================================================
   FUTURE BANK ACQUIRING WEBHOOK
========================================================= */

/*
 * This endpoint is intentionally a placeholder.
 *
 * When the real bank is selected, the bank's official
 * webhook/callback specification must be implemented here.
 *
 * NEVER allow:
 *
 * POST /webhook
 * { payment_status: "paid" }
 *
 * to mark a payment paid without verifying:
 *
 * 1. provider signature
 * 2. transaction ID
 * 3. application ID
 * 4. amount
 * 5. currency
 * 6. transaction status
 *
 * The browser must never be the source of truth.
 */

app.post(
    "/api/payments/bank/webhook",
    (req, res) => {

        if (PAYMENT_MODE !== "bank") {

            return res.status(404).json({
                error:
                    "Bank payment mode is not enabled."
            });

        }

        /*
         * TODO:
         *
         * Implement the selected bank's
         * official signature verification.
         *
         * Until a real bank is connected,
         * this endpoint does NOT change payment status.
         */

        return res.status(501).json({
            error:
                "Bank acquiring webhook is not configured yet."
        });
    }
);


/* =========================================================
   LEGAL PAGES
========================================================= */

const LEGAL_PAGES = {

    offer: {
        title: "Public Offer",
        text: `
<h1>Public Offer</h1>

<p>
ALL WORLD BRANDS provides an online service for submitting
and publishing brand information.
</p>

<h2>Service</h2>

<p>
The service allows users to submit information about a brand
for review and possible publication on the platform.
</p>

<h2>Service Fee</h2>

<p>
The standard brand submission fee is
<strong>USD 1.00</strong>.
</p>

<h2>Payment</h2>

<p>
Payment must be successfully confirmed by the payment provider
and verified by the ALL WORLD BRANDS server.
</p>

<h2>Acceptance</h2>

<p>
By submitting an application and completing payment,
the user confirms that they have read and accepted this offer.
</p>
`
    },

    privacy: {
        title: "Privacy Policy",
        text: `
<h1>Privacy Policy</h1>

<p>
ALL WORLD BRANDS respects user privacy and processes personal
information only for legitimate service purposes.
</p>

<h2>Information We May Collect</h2>

<ul>
<li>Name</li>
<li>Phone number</li>
<li>Brand information</li>
<li>Website information</li>
<li>Payment references</li>
</ul>

<h2>Payment Information</h2>

<p>
ALL WORLD BRANDS does not need to store full bank card numbers
or CVV codes. Payment information should be handled by the
authorized payment provider.
</p>

<h2>Security</h2>

<p>
Reasonable technical and organizational measures are used
to protect stored information.
</p>
`
    },

    payments: {
        title: "Payment and Refund Policy",
        text: `
<h1>Payment and Refund Policy</h1>

<h2>Payment</h2>

<p>
The standard brand application fee is
<strong>USD 1.00</strong>.
</p>

<h2>Payment Confirmation</h2>

<p>
A payment is considered completed only after server-side
confirmation from the authorized payment provider.
</p>

<h2>Failed or Cancelled Payment</h2>

<p>
If a user leaves the payment page, cancels the payment,
or the payment fails, the application remains unpaid.
</p>

<h2>Refunds</h2>

<p>
Refund requests are reviewed according to the applicable
service terms, payment-provider rules, and applicable law.
</p>
`
    },

    terms: {
        title: "Terms of Use",
        text: `
<h1>Terms of Use</h1>

<p>
By using ALL WORLD BRANDS, you agree to use the service
lawfully and responsibly.
</p>

<h2>User Content</h2>

<p>
Users are responsible for information they submit.
Users must not submit illegal, fraudulent, misleading,
harmful, or prohibited content.
</p>

<h2>Moderation</h2>

<p>
ALL WORLD BRANDS may review, reject, modify, or remove
content that violates the platform rules or applicable law.
</p>

<h2>Brand Information</h2>

<p>
Submission of a brand does not automatically guarantee
publication. Applications may require review.
</p>
`
    },

    contact: {
        title: "Legal and Contact",
        text: `
<h1>Legal and Contact</h1>

<p>
ALL WORLD BRANDS is an online brand information platform.
</p>

<h2>Service</h2>

<p>
Website:
<strong>https://allworldbrands.net</strong>
</p>

<h2>Support</h2>

<p>
For legal, payment, privacy, or account-related questions,
please use the official contact information published
on the website.
</p>

<h2>Business Information</h2>

<p>
Official business identification and contact information
should be displayed here before production launch.
</p>
`
    }

};


for (const [key, page] of Object.entries(LEGAL_PAGES)) {

    app.get(
        `/legal/${key}`,
        (req, res) => {

            res.type("html").send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1"
>

<title>
${page.title} — ALL WORLD BRANDS
</title>

<style>

body {
    margin: 0;

    background: #050914;

    color: #e5e7eb;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    line-height: 1.7;
}

main {
    max-width: 900px;

    margin: auto;

    padding: 40px 20px;
}

h1,
h2 {
    color: white;
}

a {
    color: #60a5fa;
}

.card {
    background: #111827;

    border:
        1px solid #293548;

    border-radius: 18px;

    padding: 30px;
}

</style>

</head>

<body>

<main>

<div class="card">

${page.text}

<p>
<a href="/">
Back to ALL WORLD BRANDS
</a>
</p>

</div>

</main>

</body>

</html>
`);

        }
    );
}


/* =========================================================
   ROBOTS.TXT
========================================================= */

app.get("/robots.txt", (req, res) => {

    res.type("text/plain");

    res.send(
`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`
    );

});


/* =========================================================
   SITEMAP
========================================================= */

app.get("/sitemap.xml", (req, res) => {

    const countries =
        db.prepare(`
            SELECT id
            FROM countries
        `).all();

    const brands =
        db.prepare(`
            SELECT id
            FROM brands
        `).all();

    const urls = [
        `${SITE_URL}/`,
        `${SITE_URL}/legal/offer`,
        `${SITE_URL}/legal/privacy`,
        `${SITE_URL}/legal/payments`,
        `${SITE_URL}/legal/terms`,
        `${SITE_URL}/legal/contact`
    ];

    for (const country of countries) {

        urls.push(
            `${SITE_URL}/country/${country.id}`
        );

    }

    for (const brand of brands) {

        urls.push(
            `${SITE_URL}/brand/${brand.id}`
        );

    }

    const xml =
`<?xml version="1.0" encoding="UTF-8"?>

<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.map(url => `
<url>
<loc>${escapeXml(url)}</loc>
</url>
`).join("")}

</urlset>`;

    res.type("application/xml");

    res.send(xml);
});


function escapeXml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}


/* =========================================================
   HTML PAGES
========================================================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


app.get(
    "/country/:id",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "country.html"
            )
        );

    }
);


app.get(
    "/brand/:id",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "brand.html"
            )
        );

    }
);


/* =========================================================
   404
========================================================= */

app.use((req, res) => {

    if (
        req.path.startsWith("/api/")
    ) {

        return res.status(404).json({
            error: "Not found."
        });

    }

    res.status(404).send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<title>Page Not Found — ALL WORLD BRANDS</title>

</head>

<body>

<h1>Page Not Found</h1>

<p>
The requested page could not be found.
</p>

<a href="/">
Return to ALL WORLD BRANDS
</a>

</body>

</html>
`);

});


/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {

    console.log(
        `ALL WORLD BRANDS running on port ${PORT}`
    );

    console.log(
        `Payment mode: ${PAYMENT_MODE}`
    );

    console.log(
        `Countries loaded: ${ISO_COUNTRIES.length}`
    );

});
