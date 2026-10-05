const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 3000;

const SITE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "database.db");

const PAYMENT_MODE =
    process.env.PAYMENT_MODE ||
    "demo";

const SUBMISSION_AMOUNT = 1;
const SUBMISSION_CURRENCY = "USD";

const db = new Database(DB_FILE);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");


/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    flag TEXT,
    slug TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
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
    email TEXT,

    amount REAL DEFAULT 1,
    currency TEXT DEFAULT 'USD',

    payment_status TEXT DEFAULT 'unpaid',

    payment_reference TEXT,
    payment_provider TEXT DEFAULT 'demo',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,

    FOREIGN KEY(country_id)
    REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    application_id INTEGER NOT NULL,

    amount REAL NOT NULL,
    currency TEXT NOT NULL,

    provider TEXT NOT NULL,
    status TEXT DEFAULT 'created',

    reference TEXT UNIQUE,

    payment_url TEXT,

    provider_transaction_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,

    FOREIGN KEY(application_id)
    REFERENCES brand_applications(id)
    ON DELETE CASCADE
);
`);


/* =========================================================
   SAFE MIGRATIONS
========================================================= */

function addColumnIfMissing(
    table,
    column,
    definition
) {
    const columns =
        db.prepare(
            `PRAGMA table_info(${table})`
        ).all();

    const exists =
        columns.some(
            item => item.name === column
        );

    if (!exists) {
        db.exec(
            `ALTER TABLE ${table}
             ADD COLUMN ${column} ${definition}`
        );
    }
}

addColumnIfMissing(
    "brand_applications",
    "email",
    "TEXT"
);

addColumnIfMissing(
    "brand_applications",
    "payment_provider",
    "TEXT DEFAULT 'demo'"
);

addColumnIfMissing(
    "brand_applications",
    "paid_at",
    "DATETIME"
);


/* =========================================================
   HELPERS
========================================================= */

function slugify(value) {

    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}


function uniqueSlug(
    table,
    base,
    id = null
) {

    let slug =
        slugify(base) ||
        crypto.randomUUID();

    let candidate = slug;
    let number = 2;

    while (true) {

        let row;

        if (table === "countries") {

            row = id
                ? db.prepare(
                    `SELECT id
                     FROM countries
                     WHERE slug = ?
                     AND id != ?`
                ).get(
                    candidate,
                    id
                )
                : db.prepare(
                    `SELECT id
                     FROM countries
                     WHERE slug = ?`
                ).get(candidate);

        } else {

            row = id
                ? db.prepare(
                    `SELECT id
                     FROM brands
                     WHERE slug = ?
                     AND id != ?`
                ).get(
                    candidate,
                    id
                )
                : db.prepare(
                    `SELECT id
                     FROM brands
                     WHERE slug = ?`
                ).get(candidate);
        }

        if (!row) {
            return candidate;
        }

        candidate =
            `${slug}-${number++}`;
    }
}


function safeUrl(value) {

    if (!value) {
        return "";
    }

    try {

        const url =
            new URL(
                String(value).trim()
            );

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


function normalizeEmail(value) {

    return String(value || "")
        .trim()
        .toLowerCase()
        .slice(0, 160);
}


function validEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(value);
}


/* =========================================================
   MODERATION
========================================================= */

const BLOCKED_WORDS = [
    "porn",
    "pornography",
    "xxx",
    "sex",
    "casino",
    "gambling",
    "drugs"
];

function containsBlockedContent(value) {

    const text =
        String(value || "")
            .toLowerCase();

    return BLOCKED_WORDS.some(
        word =>
            text.includes(word)
    );
}


/* =========================================================
   COUNTRIES + TERRITORIES
   ISO 3166-1 STYLE — 249 ENTRIES
========================================================= */

const countries = [

    ["Afghanistan","AF","🇦🇫"],
    ["Åland Islands","AX","🇦🇽"],
    ["Albania","AL","🇦🇱"],
    ["Algeria","DZ","🇩🇿"],
    ["American Samoa","AS","🇦🇸"],
    ["Andorra","AD","🇦🇩"],
    ["Angola","AO","🇦🇴"],
    ["Anguilla","AI","🇦🇮"],
    ["Antarctica","AQ","🇦🇶"],
    ["Antigua and Barbuda","AG","🇦🇬"],
    ["Argentina","AR","🇦🇷"],
    ["Armenia","AM","🇦🇲"],
    ["Aruba","AW","🇦🇼"],
    ["Australia","AU","🇦🇺"],
    ["Austria","AT","🇦🇹"],
    ["Azerbaijan","AZ","🇦🇿"],

    ["Bahamas","BS","🇧🇸"],
    ["Bahrain","BH","🇧🇭"],
    ["Bangladesh","BD","🇧🇩"],
    ["Barbados","BB","🇧🇧"],
    ["Belarus","BY","🇧🇾"],
    ["Belgium","BE","🇧🇪"],
    ["Belize","BZ","🇧🇿"],
    ["Benin","BJ","🇧🇯"],
    ["Bermuda","BM","🇧🇲"],
    ["Bhutan","BT","🇧🇹"],
    ["Bolivia","BO","🇧🇴"],
    ["Bonaire, Sint Eustatius and Saba","BQ","🇧🇶"],
    ["Bosnia and Herzegovina","BA","🇧🇦"],
    ["Botswana","BW","🇧🇼"],
    ["Bouvet Island","BV","🇧🇻"],
    ["Brazil","BR","🇧🇷"],
    ["British Indian Ocean Territory","IO","🇮🇴"],
    ["Brunei","BN","🇧🇳"],
    ["Bulgaria","BG","🇧🇬"],
    ["Burkina Faso","BF","🇧🇫"],
    ["Burundi","BI","🇧🇮"],

    ["Cabo Verde","CV","🇨🇻"],
    ["Cambodia","KH","🇰🇭"],
    ["Cameroon","CM","🇨🇲"],
    ["Canada","CA","🇨🇦"],
    ["Cayman Islands","KY","🇰🇾"],
    ["Central African Republic","CF","🇨🇫"],
    ["Chad","TD","🇹🇩"],
    ["Chile","CL","🇨🇱"],
    ["China","CN","🇨🇳"],
    ["Christmas Island","CX","🇨🇽"],
    ["Cocos (Keeling) Islands","CC","🇨🇨"],
    ["Colombia","CO","🇨🇴"],
    ["Comoros","KM","🇰🇲"],
    ["Congo","CG","🇨🇬"],
    ["Congo, Democratic Republic of the","CD","🇨🇩"],
    ["Cook Islands","CK","🇨🇰"],
    ["Costa Rica","CR","🇨🇷"],
    ["Côte d'Ivoire","CI","🇨🇮"],
    ["Croatia","HR","🇭🇷"],
    ["Cuba","CU","🇨🇺"],
    ["Curaçao","CW","🇨🇼"],
    ["Cyprus","CY","🇨🇾"],
    ["Czechia","CZ","🇨🇿"],

    ["Denmark","DK","🇩🇰"],
    ["Djibouti","DJ","🇩🇯"],
    ["Dominica","DM","🇩🇲"],
    ["Dominican Republic","DO","🇩🇴"],

    ["Ecuador","EC","🇪🇨"],
    ["Egypt","EG","🇪🇬"],
    ["El Salvador","SV","🇸🇻"],
    ["Equatorial Guinea","GQ","🇬🇶"],
    ["Eritrea","ER","🇪🇷"],
    ["Estonia","EE","🇪🇪"],
    ["Eswatini","SZ","🇸🇿"],
    ["Ethiopia","ET","🇪🇹"],

    ["Falkland Islands","FK","🇫🇰"],
    ["Faroe Islands","FO","🇫🇴"],
    ["Fiji","FJ","🇫🇯"],
    ["Finland","FI","🇫🇮"],
    ["France","FR","🇫🇷"],
    ["French Guiana","GF","🇬🇫"],
    ["French Polynesia","PF","🇵🇫"],
    ["French Southern Territories","TF","🇹🇫"],

    ["Gabon","GA","🇬🇦"],
    ["Gambia","GM","🇬🇲"],
    ["Georgia","GE","🇬🇪"],
    ["Germany","DE","🇩🇪"],
    ["Ghana","GH","🇬🇭"],
    ["Gibraltar","GI","🇬🇮"],
    ["Greece","GR","🇬🇷"],
    ["Greenland","GL","🇬🇱"],
    ["Grenada","GD","🇬🇩"],
    ["Guadeloupe","GP","🇬🇵"],
    ["Guam","GU","🇬🇺"],
    ["Guatemala","GT","🇬🇹"],
    ["Guernsey","GG","🇬🇬"],
    ["Guinea","GN","🇬🇳"],
    ["Guinea-Bissau","GW","🇬🇼"],
    ["Guyana","GY","🇬🇾"],

    ["Haiti","HT","🇭🇹"],
    ["Heard Island and McDonald Islands","HM","🇭🇲"],
    ["Holy See (Vatican City State)","VA","🇻🇦"],
    ["Honduras","HN","🇭🇳"],
    ["Hong Kong","HK","🇭🇰"],
    ["Hungary","HU","🇭🇺"],

    ["Iceland","IS","🇮🇸"],
    ["India","IN","🇮🇳"],
    ["Indonesia","ID","🇮🇩"],
    ["Iran","IR","🇮🇷"],
    ["Iraq","IQ","🇮🇶"],
    ["Ireland","IE","🇮🇪"],
    ["Isle of Man","IM","🇮🇲"],
    ["Israel","IL","🇮🇱"],
    ["Italy","IT","🇮🇹"],

    ["Jamaica","JM","🇯🇲"],
    ["Japan","JP","🇯🇵"],
    ["Jersey","JE","🇯🇪"],
    ["Jordan","JO","🇯🇴"],

    ["Kazakhstan","KZ","🇰🇿"],
    ["Kenya","KE","🇰🇪"],
    ["Kiribati","KI","🇰🇮"],
    ["Korea, Democratic People's Republic of","KP","🇰🇵"],
    ["Korea, Republic of","KR","🇰🇷"],
    ["Kuwait","KW","🇰🇼"],
    ["Kyrgyzstan","KG","🇰🇬"],

    ["Lao People's Democratic Republic","LA","🇱🇦"],
    ["Latvia","LV","🇱🇻"],
    ["Lebanon","LB","🇱🇧"],
    ["Lesotho","LS","🇱🇸"],
    ["Liberia","LR","🇱🇷"],
    ["Libya","LY","🇱🇾"],
    ["Liechtenstein","LI","🇱🇮"],
    ["Lithuania","LT","🇱🇹"],
    ["Luxembourg","LU","🇱🇺"],

    ["Macao","MO","🇲🇴"],
    ["Madagascar","MG","🇲🇬"],
    ["Malawi","MW","🇲🇼"],
    ["Malaysia","MY","🇲🇾"],
    ["Maldives","MV","🇲🇻"],
    ["Mali","ML","🇲🇱"],
    ["Malta","MT","🇲🇹"],
    ["Marshall Islands","MH","🇲🇭"],
    ["Martinique","MQ","🇲🇶"],
    ["Mauritania","MR","🇲🇷"],
    ["Mauritius","MU","🇲🇺"],
    ["Mayotte","YT","🇾🇹"],
    ["Mexico","MX","🇲🇽"],
    ["Micronesia","FM","🇫🇲"],
    ["Moldova","MD","🇲🇩"],
    ["Monaco","MC","🇲🇨"],
    ["Mongolia","MN","🇲🇳"],
    ["Montenegro","ME","🇲🇪"],
    ["Montserrat","MS","🇲🇸"],
    ["Morocco","MA","🇲🇦"],
    ["Mozambique","MZ","🇲🇿"],
    ["Myanmar","MM","🇲🇲"],

    ["Namibia","NA","🇳🇦"],
    ["Nauru","NR","🇳🇷"],
    ["Nepal","NP","🇳🇵"],
    ["Netherlands","NL","🇳🇱"],
    ["New Caledonia","NC","🇳🇨"],
    ["New Zealand","NZ","🇳🇿"],
    ["Nicaragua","NI","🇳🇮"],
    ["Niger","NE","🇳🇪"],
    ["Nigeria","NG","🇳🇬"],
    ["Niue","NU","🇳🇺"],
    ["Norfolk Island","NF","🇳🇫"],
    ["North Macedonia","MK","🇲🇰"],
    ["Northern Mariana Islands","MP","🇲🇵"],
    ["Norway","NO","🇳🇴"],

    ["Oman","OM","🇴🇲"],

    ["Pakistan","PK","🇵🇰"],
    ["Palau","PW","🇵🇼"],
    ["Palestine, State of","PS","🇵🇸"],
    ["Panama","PA","🇵🇦"],
    ["Papua New Guinea","PG","🇵🇬"],
    ["Paraguay","PY","🇵🇾"],
    ["Peru","PE","🇵🇪"],
    ["Philippines","PH","🇵🇭"],
    ["Pitcairn","PN","🇵🇳"],
    ["Poland","PL","🇵🇱"],
    ["Portugal","PT","🇵🇹"],
    ["Puerto Rico","PR","🇵🇷"],

    ["Qatar","QA","🇶🇦"],

    ["Réunion","RE","🇷🇪"],
    ["Romania","RO","🇷🇴"],
    ["Russian Federation","RU","🇷🇺"],
    ["Rwanda","RW","🇷🇼"],

    ["Saint Barthélemy","BL","🇧🇱"],
    ["Saint Helena, Ascension and Tristan da Cunha","SH","🇸🇭"],
    ["Saint Kitts and Nevis","KN","🇰🇳"],
    ["Saint Lucia","LC","🇱🇨"],
    ["Saint Martin (French part)","MF","🇲🇫"],
    ["Saint Pierre and Miquelon","PM","🇵🇲"],
    ["Saint Vincent and the Grenadines","VC","🇻🇨"],
    ["Samoa","WS","🇼🇸"],
    ["San Marino","SM","🇸🇲"],
    ["Sao Tome and Principe","ST","🇸🇹"],
    ["Saudi Arabia","SA","🇸🇦"],
    ["Senegal","SN","🇸🇳"],
    ["Serbia","RS","🇷🇸"],
    ["Seychelles","SC","🇸🇨"],
    ["Sierra Leone","SL","🇸🇱"],
    ["Singapore","SG","🇸🇬"],
    ["Sint Maarten (Dutch part)","SX","🇸🇽"],
    ["Slovakia","SK","🇸🇰"],
    ["Slovenia","SI","🇸🇮"],
    ["Solomon Islands","SB","🇸🇧"],
    ["Somalia","SO","🇸🇴"],
    ["South Africa","ZA","🇿🇦"],
    ["South Georgia and the South Sandwich Islands","GS","🇬🇸"],
    ["South Sudan","SS","🇸🇸"],
    ["Spain","ES","🇪🇸"],
    ["Sri Lanka","LK","🇱🇰"],
    ["Sudan","SD","🇸🇩"],
    ["Suriname","SR","🇸🇷"],
    ["Svalbard and Jan Mayen","SJ","🇸🇯"],
    ["Sweden","SE","🇸🇪"],
    ["Switzerland","CH","🇨🇭"],
    ["Syrian Arab Republic","SY","🇸🇾"],

    ["Taiwan, Province of China","TW","🇹🇼"],
    ["Tajikistan","TJ","🇹🇯"],
    ["Tanzania, United Republic of","TZ","🇹🇿"],
    ["Thailand","TH","🇹🇭"],
    ["Timor-Leste","TL","🇹🇱"],
    ["Togo","TG","🇹🇬"],
    ["Tokelau","TK","🇹🇰"],
    ["Tonga","TO","🇹🇴"],
    ["Trinidad and Tobago","TT","🇹🇹"],
    ["Tunisia","TN","🇹🇳"],
    ["Türkiye","TR","🇹🇷"],
    ["Turkmenistan","TM","🇹🇲"],
    ["Turks and Caicos Islands","TC","🇹🇨"],
    ["Tuvalu","TV","🇹🇻"],

    ["Uganda","UG","🇺🇬"],
    ["Ukraine","UA","🇺🇦"],
    ["United Arab Emirates","AE","🇦🇪"],
    ["United Kingdom","GB","🇬🇧"],
    ["United States","US","🇺🇸"],
    ["United States Minor Outlying Islands","UM","🇺🇲"],
    ["Uruguay","UY","🇺🇾"],
    ["Uzbekistan","UZ","🇺🇿"],

    ["Vanuatu","VU","🇻🇺"],
    ["Venezuela","VE","🇻🇪"],
    ["Viet Nam","VN","🇻🇳"],
    ["Virgin Islands, British","VG","🇻🇬"],
    ["Virgin Islands, U.S.","VI","🇻🇮"],

    ["Wallis and Futuna","WF","🇼🇫"],
    ["Western Sahara","EH","🇪🇭"],

    ["Yemen","YE","🇾🇪"],

    ["Zambia","ZM","🇿🇲"],
    ["Zimbabwe","ZW","🇿🇼"]
];


/* =========================================================
   SEED COUNTRIES
========================================================= */

const insertCountry =
    db.prepare(`
        INSERT OR IGNORE INTO countries
        (
            name,
            code,
            flag,
            slug
        )
        VALUES (?, ?, ?, ?)
    `);

const seedCountries =
    db.transaction(() => {

        for (
            const [
                name,
                code,
                flag
            ]
            of countries
        ) {

            insertCountry.run(
                name,
                code,
                flag,
                slugify(name)
            );
        }

    });

seedCountries();


/* =========================================================
   API — COUNTRIES
========================================================= */

app.get(
    "/api/countries",
    (req, res) => {

        const rows =
            db.prepare(`
                SELECT
                    c.id,
                    c.name,
                    c.code,
                    c.flag,
                    COUNT(b.id)
                    AS brand_count
                FROM countries c

                LEFT JOIN brands b
                    ON b.country_id = c.id

                GROUP BY c.id

                ORDER BY
                    c.name COLLATE NOCASE
            `).all();

        res.json(rows);
    }
);


/* =========================================================
   API — COUNTRY BRANDS
========================================================= */

app.get(
    "/api/countries/:id/brands",
    (req, res) => {

        const country =
            db.prepare(`
                SELECT *
                FROM countries
                WHERE id = ?
            `).get(
                req.params.id
            );

        if (!country) {

            return res.status(404).json({
                error:
                    "Country not found"
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
                ORDER BY
                    name COLLATE NOCASE
            `).all(
                country.id
            );

        res.json({
            country,
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
                    c.code AS country_code,
                    c.flag AS country_flag
                FROM brands b

                JOIN countries c
                    ON c.id = b.country_id

                WHERE b.id = ?
            `).get(
                req.params.id
            );

        if (!brand) {

            return res.status(404).json({
                error:
                    "Brand not found"
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
                ORDER BY
                    created_at DESC
            `).all(
                brand.id
            );

        res.json({
            brand,
            comments
        });
    }
);


/* =========================================================
   API — SEARCH
========================================================= */

app.get(
    "/api/search",
    (req, res) => {

        const q =
            String(req.query.q || "")
                .trim();

        if (!q) {
            return res.json([]);
        }

        const like =
            `%${q}%`;

        const rows =
            db.prepare(`
                SELECT
                    b.id,
                    b.name,
                    b.logo,
                    b.slug,

                    c.id
                    AS country_id,

                    c.name
                    AS country_name,

                    c.flag
                    AS country_flag

                FROM brands b

                JOIN countries c
                    ON c.id = b.country_id

                WHERE
                    b.name LIKE ?
                    OR c.name LIKE ?

                ORDER BY
                    b.name COLLATE NOCASE

                LIMIT 100
            `).all(
                like,
                like
            );

        res.json(rows);
    }
);


/* =========================================================
   API — COMMENTS
========================================================= */

app.post(
    "/api/comments",
    (req, res) => {

        const name =
            String(
                req.body.name || ""
            )
                .trim()
                .slice(0, 80);

        const comment =
            String(
                req.body.comment || ""
            )
                .trim()
                .slice(0, 1000);

        const brandId =
            req.body.brand_id
                ? Number(
                    req.body.brand_id
                )
                : null;

        const countryId =
            req.body.country_id
                ? Number(
                    req.body.country_id
                )
                : null;

        if (!name || !comment) {

            return res.status(400).json({
                error:
                    "Name and comment are required"
            });
        }

        if (
            containsBlockedContent(
                `${name} ${comment}`
            )
        ) {

            return res.status(400).json({
                error:
                    "Content is not allowed"
            });
        }

        /*
         * Public homepage comments can be
         * general comments, so if no target
         * is supplied we store it as a
         * general comment.
         */

        if (
            brandId &&
            !db.prepare(
                "SELECT id FROM brands WHERE id = ?"
            ).get(brandId)
        ) {

            return res.status(404).json({
                error:
                    "Brand not found"
            });
        }

        if (
            countryId &&
            !db.prepare(
                "SELECT id FROM countries WHERE id = ?"
            ).get(countryId)
        ) {

            return res.status(404).json({
                error:
                    "Country not found"
            });
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
            id:
                result.lastInsertRowid
        });
    }
);


/* =========================================================
   API — COMMENTS LIST
========================================================= */

app.get(
    "/api/comments",
    (req, res) => {

        const comments =
            db.prepare(`
                SELECT
                    id,
                    name,
                    comment,
                    brand_id,
                    country_id,
                    created_at
                FROM comments
                ORDER BY
                    created_at DESC
                LIMIT 100
            `).all();

        res.json(comments);
    }
);


/* =========================================================
   BRAND APPLICATION
   $1 USD
========================================================= */

app.post(
    "/api/brand-submissions",
    (req, res) => {

        const countryId =
            Number(
                req.body.country_id
            );

        const brandName =
            String(
                req.body.brand_name || ""
            )
                .trim()
                .slice(0, 150);

        const logo =
            safeUrl(
                req.body.logo
            );

        const website =
            safeUrl(
                req.body.website
            );

        const description =
            String(
                req.body.description || ""
            )
                .trim()
                .slice(0, 3000);

        const contactName =
            String(
                req.body.contact_name || ""
            )
                .trim()
                .slice(0, 120);

        const contactPhone =
            String(
                req.body.contact_phone || ""
            )
                .trim()
                .slice(0, 40);

        const email =
            normalizeEmail(
                req.body.email
            );

        if (
            !countryId ||
            !brandName ||
            !contactName ||
            !email
        ) {

            return res.status(400).json({
                error:
                    "Country, brand name, contact name and email are required"
            });
        }

        if (!validEmail(email)) {

            return res.status(400).json({
                error:
                    "Invalid email address"
            });
        }

        if (
            containsBlockedContent(
                `${brandName} ${description}`
            )
        ) {

            return res.status(400).json({
                error:
                    "Brand content is not allowed"
            });
        }

        const country =
            db.prepare(`
                SELECT id
                FROM countries
                WHERE id = ?
            `).get(
                countryId
            );

        if (!country) {

            return res.status(404).json({
                error:
                    "Country not found"
            });
        }

        /*
         * IMPORTANT:
         *
         * The browser cannot mark this
         * application as paid.
         *
         * It is ALWAYS created as unpaid.
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
                    email,
                    amount,
                    currency,
                    payment_status,
                    payment_provider
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    1,
                    'USD',
                    'unpaid',
                    ?
                )
            `).run(
                countryId,
                brandName,
                logo,
                website,
                description,
                contactName,
                contactPhone,
                email,
                PAYMENT_MODE
            );

        res.status(201).json({

            success: true,

            submission_id:
                result.lastInsertRowid,

            application_id:
                result.lastInsertRowid,

            amount:
                SUBMISSION_AMOUNT,

            currency:
                SUBMISSION_CURRENCY,

            payment_status:
                "unpaid",

            payment_mode:
                PAYMENT_MODE,

            message:
                "Brand application created. Payment of $1 USD is required."
        });
    }
);


/* =========================================================
   PAYMENT CREATE
   DEMO E-COMMERCE ACQUIRING LAYER
========================================================= */

app.post(
    "/api/payments/create",
    (req, res) => {

        const applicationId =
            Number(
                req.body.submission_id ||
                req.body.application_id
            );

        if (!applicationId) {

            return res.status(400).json({
                error:
                    "Application ID is required"
            });
        }

        const application =
            db.prepare(`
                SELECT *
                FROM brand_applications
                WHERE id = ?
            `).get(
                applicationId
            );

        if (!application) {

            return res.status(404).json({
                error:
                    "Application not found"
            });
        }

        if (
            application.payment_status ===
            "paid"
        ) {

            return res.status(400).json({
                error:
                    "Application is already paid"
            });
        }

        /*
         * Unique payment reference.
         *
         * Later the bank acquiring API
         * will receive this reference.
         */

        const reference =
            `AWB-${Date.now()}-${crypto
                .randomBytes(5)
                .toString("hex")
                .toUpperCase()}`;

        let paymentUrl =
            `/payment-demo/${reference}`;

        /*
         * Create payment record.
         */

        db.prepare(`
            INSERT INTO payments
            (
                application_id,
                amount,
                currency,
                provider,
                status,
                reference,
                payment_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            applicationId,
            SUBMISSION_AMOUNT,
            SUBMISSION_CURRENCY,
            PAYMENT_MODE,
            "created",
            reference,
            paymentUrl
        );

        /*
         * Store reference on application.
         */

        db.prepare(`
            UPDATE brand_applications
            SET payment_reference = ?
            WHERE id = ?
        `).run(
            reference,
            applicationId
        );

        res.json({

            success: true,

            payment_mode:
                PAYMENT_MODE,

            payment_reference:
                reference,

            payment_url:
                paymentUrl,

            amount:
                SUBMISSION_AMOUNT,

            currency:
                SUBMISSION_CURRENCY,

            status:
                "created",

            message:
                "Demo payment created."
        });
    }
);


/* =========================================================
   DEMO PAYMENT PAGE
========================================================= */

app.get(
    "/payment-demo/:reference",
    (req, res) => {

        const payment =
            db.prepare(`
                SELECT
                    p.*,
                    a.brand_name
                FROM payments p

                JOIN brand_applications a
                    ON a.id = p.application_id

                WHERE p.reference = ?
            `).get(
                req.params.reference
            );

        if (!payment) {

            return res.status(404).send(
                "Payment not found"
            );
        }

        res.send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>Demo Payment — ALL WORLD BRANDS</title>

<style>

body {
    margin:0;
    min-height:100vh;
    display:grid;
    place-items:center;
    background:#02050c;
    color:white;
    font-family:Arial,sans-serif;
}

.box {
    width:min(460px,calc(100% - 30px));
    padding:30px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:20px;
    background:#071326;
    text-align:center;
}

.amount {
    font-size:40px;
    font-weight:900;
    margin:20px 0;
}

button {
    width:100%;
    border:0;
    border-radius:12px;
    padding:14px;
    margin-top:10px;
    cursor:pointer;
    font-weight:800;
}

.pay {
    background:#00a8ff;
    color:white;
}

.cancel {
    background:rgba(255,255,255,.08);
    color:white;
}

.note {
    color:#91a4bc;
    font-size:13px;
    line-height:1.5;
    margin-top:20px;
}

</style>

</head>

<body>

<div class="box">

<h1>
ALL WORLD BRANDS
</h1>

<h2>
Demo Acquiring Payment
</h2>

<p>
Brand:
<strong>
${escapeHtml(
    payment.brand_name
)}
</strong>
</p>

<div class="amount">
$1 USD
</div>

<button
    class="pay"
    onclick="
        window.location.href =
        '/api/payments/demo-confirm/${encodeURIComponent(
            payment.reference
        )}'
    "
>
DEMO PAY
</button>

<button
    class="cancel"
    onclick="
        window.history.back()
    "
>
Cancel / Back
</button>

<div class="note">

This is a DEMO acquiring page.
No real money is charged.

Later this page will be replaced
by the bank's real acquiring payment
page/API.

</div>

</div>

</body>

</html>
        `);
    }
);


/* =========================================================
   DEMO PAYMENT CONFIRMATION
   ONLY FOR TESTING
========================================================= */

app.get(
    "/api/payments/demo-confirm/:reference",
    (req, res) => {

        if (
            PAYMENT_MODE !== "demo"
        ) {

            return res.status(403).json({
                error:
                    "Demo payment is disabled"
            });
        }

        const payment =
            db.prepare(`
                SELECT *
                FROM payments
                WHERE reference = ?
            `).get(
                req.params.reference
            );

        if (!payment) {

            return res.status(404).json({
                error:
                    "Payment not found"
            });
        }

        if (
            payment.status ===
            "paid"
        ) {

            return res.redirect(
                `/payment-result/${encodeURIComponent(
                    payment.reference
                )}`
            );
        }

        /*
         * In DEMO mode this simulates
         * a server-side acquiring
         * confirmation.
         */

        const now =
            new Date().toISOString();

        db.prepare(`
            UPDATE payments

            SET
                status = 'paid',
                provider_transaction_id = ?,
                paid_at = ?

            WHERE reference = ?
        `).run(
            `DEMO-${crypto.randomUUID()}`,
            now,
            payment.reference
        );

        db.prepare(`
            UPDATE brand_applications

            SET
                payment_status = 'paid',
                paid_at = ?

            WHERE id = ?
        `).run(
            now,
            payment.application_id
        );

        res.redirect(
            `/payment-result/${encodeURIComponent(
                payment.reference
            )}`
        );
    }
);


/* =========================================================
   PAYMENT RESULT
========================================================= */

app.get(
    "/payment-result/:reference",
    (req, res) => {

        const payment =
            db.prepare(`
                SELECT
                    p.*,
                    a.brand_name,
                    a.payment_status
                FROM payments p

                JOIN brand_applications a
                    ON a.id = p.application_id

                WHERE p.reference = ?
            `).get(
                req.params.reference
            );

        if (!payment) {

            return res.status(404).send(
                "Payment not found"
            );
        }

        const paid =
            payment.status === "paid" &&
            payment.payment_status === "paid";

        res.send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>
Payment Result — ALL WORLD BRANDS
</title>

<style>

body {
    margin:0;
    min-height:100vh;
    display:grid;
    place-items:center;
    background:#02050c;
    color:#fff;
    font-family:Arial,sans-serif;
}

.box {
    width:min(500px,calc(100% - 30px));
    padding:35px;
    border-radius:20px;
    background:#071326;
    border:1px solid rgba(255,255,255,.12);
    text-align:center;
}

.ok {
    font-size:60px;
}

.status {
    font-size:25px;
    font-weight:900;
    margin:15px;
}

a {
    display:inline-block;
    margin-top:20px;
    padding:12px 20px;
    border-radius:10px;
    background:#00a8ff;
    color:white;
    text-decoration:none;
}

</style>

</head>

<body>

<div class="box">

<div class="ok">
${paid ? "✓" : "!"}
</div>

<div class="status">
${paid ? "Payment confirmed" : "Payment pending"}
</div>

<p>
Brand:
<strong>
${escapeHtml(
    payment.brand_name
)}
</strong>
</p>

<p>
Amount:
<strong>
$1 USD
</strong>
</p>

<p>
Payment reference:
<br>
${escapeHtml(
    payment.reference
)}
</p>

<a href="/">
Back to ALL WORLD BRANDS
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
                    created_at,
                    paid_at
                FROM brand_applications
                WHERE id = ?
            `).get(
                req.params.id
            );

        if (!application) {

            return res.status(404).json({
                error:
                    "Application not found"
            });
        }

        res.json(application);
    }
);


/* =========================================================
   FUTURE BANK ACQUIRING WEBHOOK
========================================================= */

/*
 * IMPORTANT:
 *
 * When the bank is selected, this endpoint
 * will be replaced/extended according to
 * the bank's official acquiring API.
 *
 * The browser will NEVER be trusted
 * to mark a payment as paid.
 */

app.post(
    "/api/payments/webhook",
    (req, res) => {

        /*
         * DEMO:
         *
         * Do not accept arbitrary payment
         * confirmations from the public.
         *
         * Real bank signature verification
         * must be added here.
         */

        if (
            PAYMENT_MODE === "demo"
        ) {

            return res.status(501).json({
                error:
                    "Demo mode does not use a real bank webhook."
            });
        }

        return res.status(501).json({
            error:
                "Bank acquiring webhook is not configured yet."
        });
    }
);


/* =========================================================
   LEGAL PAGES
========================================================= */

app.get(
    "/legal/terms",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "terms.html"
            )
        );
    }
);


app.get(
    "/legal/privacy",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "privacy.html"
            )
        );
    }
);


app.get(
    "/legal/payment-refund",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "payment-refund.html"
            )
        );
    }
);


app.get(
    "/legal/rules",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "rules.html"
            )
        );
    }
);


app.get(
    "/legal/contact",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "contact.html"
            )
        );
    }
);


/* =========================================================
   MAIN PAGES
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


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
   ROBOTS
========================================================= */

app.get(
    "/robots.txt",
    (req, res) => {

        res.type("text/plain");

        res.send(
`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`
        );
    }
);


/* =========================================================
   SITEMAP
========================================================= */

app.get(
    "/sitemap.xml",
    (req, res) => {

        const countryRows =
            db.prepare(
                "SELECT id FROM countries"
            ).all();

        const brandRows =
            db.prepare(
                "SELECT id FROM brands"
            ).all();

        const urls = [
            `${SITE_URL}/`,
            `${SITE_URL}/legal/terms`,
            `${SITE_URL}/legal/privacy`,
            `${SITE_URL}/legal/payment-refund`,
            `${SITE_URL}/legal/rules`,
            `${SITE_URL}/legal/contact`
        ];

        for (
            const country
            of countryRows
        ) {

            urls.push(
                `${SITE_URL}/country/${country.id}`
            );
        }

        for (
            const brand
            of brandRows
        ) {

            urls.push(
                `${SITE_URL}/brand/${brand.id}`
            );
        }

        const xml =
`<?xml version="1.0" encoding="UTF-8"?>

<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls.map(
    url =>
`
<url>
<loc>${url}</loc>
</url>`
).join("")}

</urlset>`;

        res.type(
            "application/xml"
        );

        res.send(xml);
    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        const countryCount =
            db.prepare(
                "SELECT COUNT(*) AS count FROM countries"
            ).get().count;

        const brandCount =
            db.prepare(
                "SELECT COUNT(*) AS count FROM brands"
            ).get().count;

        const applicationCount =
            db.prepare(
                "SELECT COUNT(*) AS count FROM brand_applications"
            ).get().count;

        res.json({

            ok: true,

            site:
                "ALL WORLD BRANDS",

            payment_mode:
                PAYMENT_MODE,

            submission_price:
                "$1 USD",

            countries:
                countryCount,

            brands:
                brandCount,

            applications:
                applicationCount
        });
    }
);


/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(404).json({
                error:
                    "Not found"
            });
        }

        res.status(404).send(
            "Page not found"
        );
    }
);


/* =========================================================
   SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `ALL WORLD BRANDS running on port ${PORT}`
        );

        console.log(
            `Payment mode: ${PAYMENT_MODE}`
        );

        console.log(
            `Submission price: $1 USD`
        );
    }
);
