const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT) || 3000;

const SITE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "database.db");

/*
 * DEMO_ACQUIRING=true by default.
 * Set DEMO_ACQUIRING=false only when a real
 * bank acquiring integration is implemented.
 */
const DEMO_ACQUIRING =
    process.env.DEMO_ACQUIRING !== "false";

/*
 * Current service price:
 * $1 USD
 */
const SUBMISSION_AMOUNT = 1;
const SUBMISSION_CURRENCY = "USD";

/* =========================================================
   APP
========================================================= */

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================================================
   DATABASE
========================================================= */

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    flag TEXT,
    type TEXT DEFAULT 'country',
    slug TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS country_images (
    country_id INTEGER PRIMARY KEY,
    image_url TEXT,
    image_title TEXT,
    source_url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(country_id) REFERENCES countries(id) ON DELETE CASCADE
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
    contact_email TEXT,

    amount REAL NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',

    payment_status TEXT NOT NULL DEFAULT 'unpaid',

    payment_provider TEXT DEFAULT 'demo_acquiring',

    payment_reference TEXT,

    payment_url TEXT,

    paid_at DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(country_id)
        REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    application_id INTEGER NOT NULL,

    provider TEXT NOT NULL,

    reference TEXT NOT NULL UNIQUE,

    amount REAL NOT NULL,

    currency TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'created',

    provider_transaction_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    paid_at DATETIME,

    FOREIGN KEY(application_id)
        REFERENCES brand_applications(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

/* =========================================================
   SAFE MIGRATIONS
========================================================= */

function columnExists(table, column) {
    const allowedTables = [
        "countries",
        "brands",
        "comments",
        "brand_applications",
        "payment_transactions",
        "admin_users"
    ];

    if (!allowedTables.includes(table)) {
        return false;
    }

    const columns = db
        .prepare(`PRAGMA table_info(${table})`)
        .all();

    return columns.some(
        item => item.name === column
    );
}

function addColumnIfMissing(
    table,
    column,
    definition
) {
    if (!columnExists(table, column)) {
        db.exec(`
            ALTER TABLE ${table}
            ADD COLUMN ${column} ${definition}
        `);
    }
}

addColumnIfMissing(
    "brand_applications",
    "contact_email",
    "TEXT"
);

addColumnIfMissing(
    "brand_applications",
    "payment_provider",
    "TEXT DEFAULT 'demo_acquiring'"
);

addColumnIfMissing(
    "brand_applications",
    "payment_reference",
    "TEXT"
);

addColumnIfMissing(
    "brand_applications",
    "payment_url",
    "TEXT"
);

addColumnIfMissing(
    "brand_applications",
    "paid_at",
    "DATETIME"
);

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value, max = 1000) {
    return String(value ?? "")
        .trim()
        .slice(0, max);
}

function normalizeEmail(value) {
    return cleanText(value, 160)
        .toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}

function htmlEscape(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function uniqueSlug(table, base, id = null) {

    const allowedTables = [
        "countries",
        "brands"
    ];

    if (!allowedTables.includes(table)) {
        throw new Error("Invalid table");
    }

    const original =
        slugify(base) ||
        crypto.randomUUID();

    let candidate = original;
    let number = 2;

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

        candidate =
            `${original}-${number++}`;
    }
}

function safeUrl(value) {

    if (!value) {
        return "";
    }

    try {

        const url =
            new URL(String(value).trim());

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

function safeInteger(value) {

    const number = Number(value);

    if (
        !Number.isInteger(number) ||
        number <= 0
    ) {
        return null;
    }

    return number;
}

/* =========================================================
   COUNTRY / TERRITORY DATA
========================================================= */

const locations = [

    ["Afghanistan","AF","🇦🇫","country"],
    ["Albania","AL","🇦🇱","country"],
    ["Algeria","DZ","🇩🇿","country"],
    ["Andorra","AD","🇦🇩","country"],
    ["Angola","AO","🇦🇴","country"],
    ["Anguilla","AI","🇦🇮","territory"],
    ["Antarctica","AQ","🇦🇶","territory"],
    ["Antigua and Barbuda","AG","🇦🇬","country"],
    ["Argentina","AR","🇦🇷","country"],
    ["Armenia","AM","🇦🇲","country"],
    ["Aruba","AW","🇦🇼","territory"],
    ["Australia","AU","🇦🇺","country"],
    ["Austria","AT","🇦🇹","country"],
    ["Azerbaijan","AZ","🇦🇿","country"],

    ["Bahamas","BS","🇧🇸","country"],
    ["Bahrain","BH","🇧🇭","country"],
    ["Bangladesh","BD","🇧🇩","country"],
    ["Barbados","BB","🇧🇧","country"],
    ["Belarus","BY","🇧🇾","country"],
    ["Belgium","BE","🇧🇪","country"],
    ["Belize","BZ","🇧🇿","country"],
    ["Benin","BJ","🇧🇯","country"],
    ["Bermuda","BM","🇧🇲","territory"],
    ["Bhutan","BT","🇧🇹","country"],
    ["Bolivia","BO","🇧🇴","country"],
    ["Bonaire, Sint Eustatius and Saba","BQ","🇧🇶","territory"],
    ["Bosnia and Herzegovina","BA","🇧🇦","country"],
    ["Botswana","BW","🇧🇼","country"],
    ["Bouvet Island","BV","🇧🇻","territory"],
    ["Brazil","BR","🇧🇷","country"],
    ["British Indian Ocean Territory","IO","🇮🇴","territory"],
    ["Brunei","BN","🇧🇳","country"],
    ["Bulgaria","BG","🇧🇬","country"],
    ["Burkina Faso","BF","🇧🇫","country"],
    ["Burundi","BI","🇧🇮","country"],

    ["Cabo Verde","CV","🇨🇻","country"],
    ["Cambodia","KH","🇰🇭","country"],
    ["Cameroon","CM","🇨🇲","country"],
    ["Canada","CA","🇨🇦","country"],
    ["Cayman Islands","KY","🇰🇾","territory"],
    ["Central African Republic","CF","🇨🇫","country"],
    ["Chad","TD","🇹🇩","country"],
    ["Chile","CL","🇨🇱","country"],
    ["China","CN","🇨🇳","country"],
    ["Christmas Island","CX","🇨🇽","territory"],
    ["Cocos Islands","CC","🇨🇨","territory"],
    ["Colombia","CO","🇨🇴","country"],
    ["Comoros","KM","🇰🇲","country"],
    ["Congo","CG","🇨🇬","country"],
    ["Cook Islands","CK","🇨🇰","territory"],
    ["Costa Rica","CR","🇨🇷","country"],
    ["Croatia","HR","🇭🇷","country"],
    ["Cuba","CU","🇨🇺","country"],
    ["Curaçao","CW","🇨🇼","territory"],
    ["Cyprus","CY","🇨🇾","country"],
    ["Czechia","CZ","🇨🇿","country"],

    ["Denmark","DK","🇩🇰","country"],
    ["Djibouti","DJ","🇩🇯","country"],
    ["Dominica","DM","🇩🇲","country"],
    ["Dominican Republic","DO","🇩🇴","country"],

    ["Ecuador","EC","🇪🇨","country"],
    ["Egypt","EG","🇪🇬","country"],
    ["El Salvador","SV","🇸🇻","country"],
    ["Equatorial Guinea","GQ","🇬🇶","country"],
    ["Eritrea","ER","🇪🇷","country"],
    ["Estonia","EE","🇪🇪","country"],
    ["Eswatini","SZ","🇸🇿","country"],
    ["Ethiopia","ET","🇪🇹","country"],

    ["Falkland Islands","FK","🇫🇰","territory"],
    ["Faroe Islands","FO","🇫🇴","territory"],
    ["Fiji","FJ","🇫🇯","country"],
    ["Finland","FI","🇫🇮","country"],
    ["France","FR","🇫🇷","country"],
    ["French Guiana","GF","🇬🇫","territory"],
    ["French Polynesia","PF","🇵🇫","territory"],
    ["French Southern Territories","TF","🇹🇫","territory"],

    ["Gabon","GA","🇬🇦","country"],
    ["Gambia","GM","🇬🇲","country"],
    ["Georgia","GE","🇬🇪","country"],
    ["Germany","DE","🇩🇪","country"],
    ["Ghana","GH","🇬🇭","country"],
    ["Gibraltar","GI","🇬🇮","territory"],
    ["Greece","GR","🇬🇷","country"],
    ["Greenland","GL","🇬🇱","territory"],
    ["Grenada","GD","🇬🇩","country"],
    ["Guadeloupe","GP","🇬🇵","territory"],
    ["Guam","GU","🇬🇺","territory"],
    ["Guatemala","GT","🇬🇹","country"],
    ["Guernsey","GG","🇬🇬","territory"],
    ["Guinea","GN","🇬🇳","country"],
    ["Guinea-Bissau","GW","🇬🇼","country"],
    ["Guyana","GY","🇬🇾","country"],

    ["Haiti","HT","🇭🇹","country"],
    ["Heard Island and McDonald Islands","HM","🇭🇲","territory"],
    ["Holy See","VA","🇻🇦","country"],
    ["Honduras","HN","🇭🇳","country"],
    ["Hong Kong","HK","🇭🇰","territory"],
    ["Hungary","HU","🇭🇺","country"],

    ["Iceland","IS","🇮🇸","country"],
    ["India","IN","🇮🇳","country"],
    ["Indonesia","ID","🇮🇩","country"],
    ["Iran","IR","🇮🇷","country"],
    ["Iraq","IQ","🇮🇶","country"],
    ["Ireland","IE","🇮🇪","country"],
    ["Isle of Man","IM","🇮🇲","territory"],
    ["Israel","IL","🇮🇱","country"],
    ["Italy","IT","🇮🇹","country"],

    ["Jamaica","JM","🇯🇲","country"],
    ["Japan","JP","🇯🇵","country"],
    ["Jersey","JE","🇯🇪","territory"],
    ["Jordan","JO","🇯🇴","country"],

    ["Kazakhstan","KZ","🇰🇿","country"],
    ["Kenya","KE","🇰🇪","country"],
    ["Kiribati","KI","🇰🇮","country"],
    ["Kuwait","KW","🇰🇼","country"],
    ["Kyrgyzstan","KG","🇰🇬","country"],

    ["Laos","LA","🇱🇦","country"],
    ["Latvia","LV","🇱🇻","country"],
    ["Lebanon","LB","🇱🇧","country"],
    ["Lesotho","LS","🇱🇸","country"],
    ["Liberia","LR","🇱🇷","country"],
    ["Libya","LY","🇱🇾","country"],
    ["Liechtenstein","LI","🇱🇮","country"],
    ["Lithuania","LT","🇱🇹","country"],
    ["Luxembourg","LU","🇱🇺","country"],

    ["Macao","MO","🇲🇴","territory"],
    ["Madagascar","MG","🇲🇬","country"],
    ["Malawi","MW","🇲🇼","country"],
    ["Malaysia","MY","🇲🇾","country"],
    ["Maldives","MV","🇲🇻","country"],
    ["Mali","ML","🇲🇱","country"],
    ["Malta","MT","🇲🇹","country"],
    ["Marshall Islands","MH","🇲🇭","country"],
    ["Martinique","MQ","🇲🇶","territory"],
    ["Mauritania","MR","🇲🇷","country"],
    ["Mauritius","MU","🇲🇺","country"],
    ["Mayotte","YT","🇾🇹","territory"],
    ["Mexico","MX","🇲🇽","country"],
    ["Micronesia","FM","🇫🇲","country"],
    ["Moldova","MD","🇲🇩","country"],
    ["Monaco","MC","🇲🇨","country"],
    ["Mongolia","MN","🇲🇳","country"],
    ["Montenegro","ME","🇲🇪","country"],
    ["Montserrat","MS","🇲🇸","territory"],
    ["Morocco","MA","🇲🇦","country"],
    ["Mozambique","MZ","🇲🇿","country"],
    ["Myanmar","MM","🇲🇲","country"],

    ["Namibia","NA","🇳🇦","country"],
    ["Nauru","NR","🇳🇷","country"],
    ["Nepal","NP","🇳🇵","country"],
    ["Netherlands","NL","🇳🇱","country"],
    ["New Caledonia","NC","🇳🇨","territory"],
    ["New Zealand","NZ","🇳🇿","country"],
    ["Nicaragua","NI","🇳🇮","country"],
    ["Niger","NE","🇳🇪","country"],
    ["Nigeria","NG","🇳🇬","country"],
    ["Niue","NU","🇳🇺","territory"],
    ["Norfolk Island","NF","🇳🇫","territory"],
    ["North Korea","KP","🇰🇵","country"],
    ["North Macedonia","MK","🇲🇰","country"],
    ["Northern Mariana Islands","MP","🇲🇵","territory"],
    ["Norway","NO","🇳🇴","country"],

    ["Oman","OM","🇴🇲","country"],

    ["Pakistan","PK","🇵🇰","country"],
    ["Palau","PW","🇵🇼","country"],
    ["Palestine","PS","🇵🇸","territory"],
    ["Panama","PA","🇵🇦","country"],
    ["Papua New Guinea","PG","🇵🇬","country"],
    ["Paraguay","PY","🇵🇾","country"],
    ["Peru","PE","🇵🇪","country"],
    ["Philippines","PH","🇵🇭","country"],
    ["Pitcairn","PN","🇵🇳","territory"],
    ["Poland","PL","🇵🇱","country"],
    ["Portugal","PT","🇵🇹","country"],
    ["Puerto Rico","PR","🇵🇷","territory"],

    ["Qatar","QA","🇶🇦","country"],

    ["Réunion","RE","🇷🇪","territory"],
    ["Romania","RO","🇷🇴","country"],
    ["Russia","RU","🇷🇺","country"],
    ["Rwanda","RW","🇷🇼","country"],

    ["Saint Barthélemy","BL","🇧🇱","territory"],
    ["Saint Helena","SH","🇸🇭","territory"],
    ["Saint Kitts and Nevis","KN","🇰🇳","country"],
    ["Saint Lucia","LC","🇱🇨","country"],
    ["Saint Martin","MF","🇲🇫","territory"],
    ["Saint Pierre and Miquelon","PM","🇵🇲","territory"],
    ["Saint Vincent and the Grenadines","VC","🇻🇨","country"],
    ["Samoa","WS","🇼🇸","country"],
    ["San Marino","SM","🇸🇲","country"],
    ["Sao Tome and Principe","ST","🇸🇹","country"],
    ["Saudi Arabia","SA","🇸🇦","country"],
    ["Senegal","SN","🇸🇳","country"],
    ["Serbia","RS","🇷🇸","country"],
    ["Seychelles","SC","🇸🇨","country"],
    ["Sierra Leone","SL","🇸🇱","country"],
    ["Singapore","SG","🇸🇬","country"],
    ["Sint Maarten","SX","🇸🇽","territory"],
    ["Slovakia","SK","🇸🇰","country"],
    ["Slovenia","SI","🇸🇮","country"],
    ["Solomon Islands","SB","🇸🇧","country"],
    ["Somalia","SO","🇸🇴","country"],
    ["South Africa","ZA","🇿🇦","country"],
    ["South Georgia and the South Sandwich Islands","GS","🇬🇸","territory"],
    ["South Korea","KR","🇰🇷","country"],
    ["South Sudan","SS","🇸🇸","country"],
    ["Spain","ES","🇪🇸","country"],
    ["Sri Lanka","LK","🇱🇰","country"],
    ["Sudan","SD","🇸🇩","country"],
    ["Suriname","SR","🇸🇷","country"],
    ["Svalbard and Jan Mayen","SJ","🇸🇯","territory"],
    ["Sweden","SE","🇸🇪","country"],
    ["Switzerland","CH","🇨🇭","country"],
    ["Syria","SY","🇸🇾","country"],

    ["Taiwan","TW","🇹🇼","territory"],
    ["Tajikistan","TJ","🇹🇯","country"],
    ["Tanzania","TZ","🇹🇿","country"],
    ["Thailand","TH","🇹🇭","country"],
    ["Timor-Leste","TL","🇹🇱","country"],
    ["Togo","TG","🇹🇬","country"],
    ["Tokelau","TK","🇹🇰","territory"],
    ["Tonga","TO","🇹🇴","country"],
    ["Trinidad and Tobago","TT","🇹🇹","country"],
    ["Tunisia","TN","🇹🇳","country"],
    ["Turkey","TR","🇹🇷","country"],
    ["Turkmenistan","TM","🇹🇲","country"],
    ["Turks and Caicos Islands","TC","🇹🇨","territory"],
    ["Tuvalu","TV","🇹🇻","country"],

    ["Uganda","UG","🇺🇬","country"],
    ["Ukraine","UA","🇺🇦","country"],
    ["United Arab Emirates","AE","🇦🇪","country"],
    ["United Kingdom","GB","🇬🇧","country"],
    ["United States","US","🇺🇸","country"],
    ["United States Minor Outlying Islands","UM","🇺🇲","territory"],
    ["Uruguay","UY","🇺🇾","country"],
    ["Uzbekistan","UZ","🇺🇿","country"],

    ["Vanuatu","VU","🇻🇺","country"],
    ["Vatican City","VA","🇻🇦","country"],
    ["Venezuela","VE","🇻🇪","country"],
    ["Vietnam","VN","🇻🇳","country"],
    ["Virgin Islands, British","VG","🇻🇬","territory"],
    ["Virgin Islands, U.S.","VI","🇻🇮","territory"],

    ["Wallis and Futuna","WF","🇼🇫","territory"],
    ["Western Sahara","EH","🇪🇭","territory"],
    ["Yemen","YE","🇾🇪","country"],
    ["Zambia","ZM","🇿🇲","country"],
    ["Zimbabwe","ZW","🇿🇼","country"]
];

/* =========================================================
   SEED COUNTRIES
========================================================= */

const insertLocation = db.prepare(`
    INSERT OR IGNORE INTO countries
    (
        name,
        code,
        flag,
        type,
        slug
    )
    VALUES (?, ?, ?, ?, ?)
`);

const seedLocations = db.transaction(() => {

    for (const [
        name,
        code,
        flag,
        type
    ] of locations) {

        insertLocation.run(
            name,
            code,
            flag,
            type,
            slugify(name)
        );
    }
});

seedLocations();

/* =========================================================
   API — COUNTRIES
========================================================= */

app.get(
    "/api/countries",
    (req, res) => {

        try {

            const rows = db.prepare(`
                SELECT
                    c.id,
                    c.name,
                    c.code,
                    c.flag,
                    c.type,
                    c.slug,
                    COUNT(b.id) AS brand_count
                FROM countries c

                LEFT JOIN brands b
                    ON b.country_id = c.id

                GROUP BY c.id

                ORDER BY
                    c.name COLLATE NOCASE
            `).all();

            res.json(rows);

        } catch (error) {

            console.error(
                "COUNTRIES ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Countries could not be loaded."
            });
        }
    }
);

/* =========================================================
   API — COUNTRY
========================================================= */

app.get(
    "/api/countries/:id",
    (req, res) => {

        const id =
            safeInteger(req.params.id);

        if (!id) {
            return res.status(400).json({
                error:
                    "Invalid country ID."
            });
        }

        const country =
            db.prepare(`
                SELECT
                    id,
                    name,
                    code,
                    flag,
                    type,
                    slug
                FROM countries
                WHERE id = ?
            `).get(id);

        if (!country) {

            return res.status(404).json({
                error:
                    "Country or territory not found."
            });
        }

        res.json(country);
    }
);

/* =========================================================
   API — COUNTRY BRANDS
========================================================= */

app.get(
    "/api/countries/:id/brands",
    (req, res) => {

        const id =
            safeInteger(req.params.id);

        if (!id) {
            return res.status(400).json({
                error:
                    "Invalid country ID."
            });
        }

        const country =
            db.prepare(`
                SELECT
                    id,
                    name,
                    code,
                    flag,
                    type,
                    slug
                FROM countries
                WHERE id = ?
            `).get(id);

        if (!country) {

            return res.status(404).json({
                error:
                    "Country or territory not found."
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
            `).all(id);

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

        const id =
            safeInteger(req.params.id);

        if (!id) {
            return res.status(400).json({
                error:
                    "Invalid brand ID."
            });
        }

        const brand =
            db.prepare(`
                SELECT
                    b.*,

                    c.name AS country_name,
                    c.code AS country_code,
                    c.flag AS country_flag,
                    c.type AS country_type

                FROM brands b

                JOIN countries c
                    ON c.id = b.country_id

                WHERE b.id = ?
            `).get(id);

        if (!brand) {

            return res.status(404).json({
                error:
                    "Brand not found."
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
            `).all(id);

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
            cleanText(
                req.query.q,
                100
            );

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

                    c.id AS country_id,
                    c.name AS country_name,
                    c.flag AS country_flag,
                    c.type AS country_type

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
   COMMENTS
========================================================= */

app.get(
    "/api/comments",
    (req, res) => {

        const rows =
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

        res.json(rows);
    }
);

app.post(
    "/api/comments",
    (req, res) => {

        const name =
            cleanText(
                req.body.name,
                80
            );

        const comment =
            cleanText(
                req.body.comment,
                1000
            );

        const brandId =
            req.body.brand_id
                ? safeInteger(
                    req.body.brand_id
                )
                : null;

        const countryId =
            req.body.country_id
                ? safeInteger(
                    req.body.country_id
                )
                : null;

        if (!name || !comment) {

            return res.status(400).json({
                error:
                    "Name and comment are required."
            });
        }

        if (!brandId && !countryId) {

            return res.status(400).json({
                error:
                    "Brand or country is required."
            });
        }

        if (
            brandId &&
            !db.prepare(`
                SELECT id
                FROM brands
                WHERE id = ?
            `).get(brandId)
        ) {

            return res.status(404).json({
                error:
                    "Brand not found."
            });
        }

        if (
            countryId &&
            !db.prepare(`
                SELECT id
                FROM countries
                WHERE id = ?
            `).get(countryId)
        ) {

            return res.status(404).json({
                error:
                    "Country or territory not found."
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
   BRAND APPLICATION
========================================================= */

function createBrandApplication(req, res) {

    try {

        const countryId =
            safeInteger(
                req.body.country_id
            );

        const brandName =
            cleanText(
                req.body.brand_name ||
                req.body.name,
                150
            );

        const logo =
            safeUrl(
                req.body.logo
            );

        const website =
            safeUrl(
                req.body.website
            );

        const description =
            cleanText(
                req.body.description,
                3000
            );

        const contactName =
            cleanText(
                req.body.contact_name,
                120
            );

        const contactPhone =
            cleanText(
                req.body.contact_phone ||
                req.body.phone,
                40
            );

        const contactEmail =
            normalizeEmail(
                req.body.contact_email ||
                req.body.email
            );

        if (
            !countryId ||
            !brandName ||
            !contactName ||
            !contactEmail
        ) {

            return res.status(400).json({
                error:
                    "Country, brand name, contact name and email are required."
            });
        }

        if (
            !isValidEmail(
                contactEmail
            )
        ) {

            return res.status(400).json({
                error:
                    "Please enter a valid email address."
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
                error:
                    "Country or territory not found."
            });
        }

        /*
         * SECURITY:
         *
         * payment_status is NEVER accepted
         * from the browser.
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
                    contact_email,
                    amount,
                    currency,
                    payment_status,
                    payment_provider
                )
                VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                countryId,
                brandName,
                logo,
                website,
                description,
                contactName,
                contactPhone,
                contactEmail,
                SUBMISSION_AMOUNT,
                SUBMISSION_CURRENCY,
                "unpaid",
                DEMO_ACQUIRING
                    ? "demo_acquiring"
                    : "bank_acquiring"
            );

        res.status(201).json({

            success: true,

            application_id:
                Number(
                    result.lastInsertRowid
                ),

            amount:
                SUBMISSION_AMOUNT,

            currency:
                SUBMISSION_CURRENCY,

            payment_status:
                "unpaid",

            message:
                "Application created. Payment of $1 USD is required."
        });

    } catch (error) {

        console.error(
            "APPLICATION ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Could not create brand application."
        });
    }
}

/*
 * Main endpoint.
 */
app.post(
    "/api/brand-applications",
    createBrandApplication
);

/*
 * Compatibility endpoint for old index.html.
 *
 * FIXED:
 * It directly executes the same handler instead
 * of modifying req.url and calling next().
 */
app.post(
    "/api/brand-submissions",
    createBrandApplication
);

/* =========================================================
   PAYMENT — CREATE
========================================================= */

app.post(
    "/api/payments/create",
    (req, res) => {

        try {

            const applicationId =
                safeInteger(
                    req.body.submission_id ||
                    req.body.application_id
                );

            if (!applicationId) {

                return res.status(400).json({
                    error:
                        "Application ID is required."
                });
            }

            const application =
                db.prepare(`
                    SELECT *
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
                application.payment_status ===
                "paid"
            ) {

                return res.json({

                    success: true,

                    payment_status:
                        "paid",

                    message:
                        "Payment has already been confirmed."
                });
            }

            /*
             * Do not create unlimited duplicate
             * transactions when the same application
             * requests payment again.
             */

            const existing =
                db.prepare(`
                    SELECT *
                    FROM payment_transactions
                    WHERE application_id = ?
                    AND status = 'created'
                    ORDER BY id DESC
                    LIMIT 1
                `).get(applicationId);

            if (existing) {

                const paymentUrl =
                    existing.provider ===
                    "demo_acquiring"

                        ? `/payment/demo/${existing.id}`

                        : application.payment_url;

                return res.json({

                    success: true,

                    provider:
                        existing.provider,

                    transaction_id:
                        existing.id,

                    payment_reference:
                        existing.reference,

                    payment_url:
                        paymentUrl,

                    amount:
                        existing.amount,

                    currency:
                        existing.currency,

                    payment_status:
                        "unpaid"
                });
            }

            const reference =
                `DEMO-${Date.now()}-${crypto
                    .randomBytes(5)
                    .toString("hex")
                    .toUpperCase()}`;

            const transaction =
                db.prepare(`
                    INSERT INTO payment_transactions
                    (
                        application_id,
                        provider,
                        reference,
                        amount,
                        currency,
                        status
                    )
                    VALUES
                    (?, ?, ?, ?, ?, 'created')
                `).run(
                    applicationId,
                    DEMO_ACQUIRING
                        ? "demo_acquiring"
                        : "bank_acquiring",
                    reference,
                    application.amount,
                    application.currency
                );

            const transactionId =
                Number(
                    transaction.lastInsertRowid
                );

            /*
             * Demo checkout.
             *
             * Real bank acquiring should replace
             * this part later.
             */

            const paymentUrl =
                DEMO_ACQUIRING
                    ? `/payment/demo/${transactionId}`
                    : "";

            db.prepare(`
                UPDATE brand_applications

                SET
                    payment_reference = ?,
                    payment_url = ?,
                    payment_provider = ?

                WHERE id = ?
            `).run(
                reference,
                paymentUrl,
                DEMO_ACQUIRING
                    ? "demo_acquiring"
                    : "bank_acquiring",
                applicationId
            );

            res.json({

                success: true,

                provider:
                    DEMO_ACQUIRING
                        ? "demo_acquiring"
                        : "bank_acquiring",

                demo:
                    DEMO_ACQUIRING,

                transaction_id:
                    transactionId,

                payment_reference:
                    reference,

                payment_url:
                    paymentUrl,

                amount:
                    application.amount,

                currency:
                    application.currency,

                payment_status:
                    "unpaid"
            });

        } catch (error) {

            console.error(
                "PAYMENT CREATE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Payment could not be created."
            });
        }
    }
);

/* =========================================================
   DEMO PAYMENT PAGE
========================================================= */

app.get(
    "/payment/demo/:id",
    (req, res) => {

        const id =
            safeInteger(
                req.params.id
            );

        if (!id) {
            return res.status(400).send(
                "Invalid transaction ID."
            );
        }

        const transaction =
            db.prepare(`
                SELECT
                    pt.*,
                    ba.brand_name
                FROM payment_transactions pt

                JOIN brand_applications ba
                    ON ba.id = pt.application_id

                WHERE pt.id = ?
            `).get(id);

        if (!transaction) {

            return res.status(404).send(
                "Payment transaction not found."
            );
        }

        if (
            transaction.status ===
            "paid"
        ) {

            return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width, initial-scale=1.0">
<title>Payment Confirmed</title>

<style>
body{
    margin:0;
    min-height:100vh;
    display:grid;
    place-items:center;
    background:#02050c;
    color:white;
    font-family:Arial,sans-serif;
}

.box{
    width:min(500px,calc(100% - 30px));
    padding:35px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:20px;
    background:#071326;
    text-align:center;
}

h1{
    color:#8dffb5;
}

a{
    color:#80d5ff;
}
</style>
</head>

<body>

<div class="box">

<h1>
Payment Confirmed
</h1>

<p>
Your $1 USD payment has been confirmed.
</p>

<p>
Brand application:
<strong>
${htmlEscape(transaction.brand_name)}
</strong>
</p>

<a href="/">
Return to ALL WORLD BRANDS
</a>

</div>

</body>
</html>
            `);
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

<title>
Demo Acquiring — $1 USD
</title>

<style>

*{
    box-sizing:border-box;
}

body{

    margin:0;

    min-height:100vh;

    display:grid;

    place-items:center;

    background:
        radial-gradient(
            circle at top,
            #0b3150,
            #02050c 60%
        );

    color:#fff;

    font-family:
        Inter,
        Arial,
        sans-serif;
}

.box{

    width:
        min(
            500px,
            calc(100% - 30px)
        );

    padding:32px;

    border:
        1px solid
        rgba(255,255,255,.12);

    border-radius:22px;

    background:
        rgba(7,19,38,.94);

    box-shadow:
        0 25px 80px
        rgba(0,0,0,.45);
}

h1{
    margin-top:0;
}

.amount{

    font-size:32px;

    font-weight:900;

    margin:20px 0;
}

.reference{

    color:#91a4bc;

    font-size:13px;

    word-break:break-all;
}

button{

    width:100%;

    border:0;

    border-radius:12px;

    padding:14px;

    margin-top:20px;

    background:
        linear-gradient(
            135deg,
            #00a8ff,
            #0064ff
        );

    color:white;

    font-size:16px;

    font-weight:800;

    cursor:pointer;
}

.cancel{

    display:block;

    text-align:center;

    margin-top:15px;

    color:#9eb1c7;

    text-decoration:none;

    font-size:13px;
}

.note{

    margin-top:20px;

    color:#8ea1b8;

    font-size:12px;

    line-height:1.5;
}

</style>

</head>

<body>

<div class="box">

<h1>
Demo Acquiring
</h1>

<p>
This is a temporary payment page.
The real bank Internet Acquiring system
will be connected later.
</p>

<div class="amount">
$1.00 USD
</div>

<p>
Brand application:
<strong>
${htmlEscape(transaction.brand_name)}
</strong>
</p>

<p class="reference">
Payment reference:
${htmlEscape(transaction.reference)}
</p>

<form
method="POST"
action="/api/payments/demo/confirm"
>

<input
type="hidden"
name="transaction_id"
value="${transaction.id}"
>

<button type="submit">
Confirm Demo Payment
</button>

</form>

<a
class="cancel"
href="/"
>
Cancel and return
</a>

<div class="note">
Demo mode only. No real money is charged.
The final payment status is created by the
server, not by the browser.
</div>

</div>

</body>

</html>
        `);
    }
);

/* =========================================================
   DEMO PAYMENT CONFIRMATION
========================================================= */

app.post(
    "/api/payments/demo/confirm",
    (req, res) => {

        const transactionId =
            safeInteger(
                req.body.transaction_id
            );

        if (!transactionId) {

            return res.status(400).json({
                error:
                    "Transaction ID is required."
            });
        }

        const transaction =
            db.prepare(`
                SELECT *
                FROM payment_transactions
                WHERE id = ?
            `).get(transactionId);

        if (!transaction) {

            return res.status(404).json({
                error:
                    "Transaction not found."
            });
        }

        const now =
            new Date().toISOString();

        const providerTransactionId =
            `DEMO-${crypto
                .randomBytes(8)
                .toString("hex")}`;

        const update =
            db.transaction(() => {

                db.prepare(`
                    UPDATE payment_transactions

                    SET
                        status = 'paid',
                        provider_transaction_id = ?,
                        paid_at = ?

                    WHERE id = ?
                    AND status != 'paid'
                `).run(
                    providerTransactionId,
                    now,
                    transactionId
                );

                db.prepare(`
                    UPDATE brand_applications

                    SET
                        payment_status = 'paid',
                        paid_at = ?,
                        payment_reference = ?

                    WHERE id = ?
                    AND payment_status != 'paid'
                `).run(
                    now,
                    transaction.reference,
                    transaction.application_id
                );
            });

        update();

        /*
         * Redirect instead of leaving the browser
         * on a raw JSON response.
         *
         * This makes the payment flow easier for
         * the frontend.
         */
        res.redirect(
            `/payment/demo/${transactionId}`
        );
    }
);

/* =========================================================
   PAYMENT STATUS
========================================================= */

app.get(
    "/api/brand-applications/:id",
    (req, res) => {

        const id =
            safeInteger(
                req.params.id
            );

        if (!id) {

            return res.status(400).json({
                error:
                    "Invalid application ID."
            });
        }

        const application =
            db.prepare(`
                SELECT
                    id,
                    country_id,
                    brand_name,
                    amount,
                    currency,
                    payment_status,
                    payment_provider,
                    payment_reference,
                    paid_at,
                    created_at
                FROM brand_applications
                WHERE id = ?
            `).get(id);

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
   PAYMENT VERIFICATION
========================================================= */

app.post(
    "/api/payments/verify",
    (req, res) => {

        const reference =
            cleanText(
                req.body.payment_reference,
                200
            );

        if (!reference) {

            return res.status(400).json({
                error:
                    "Payment reference is required."
            });
        }

        const transaction =
            db.prepare(`
                SELECT
                    pt.*,
                    ba.payment_status AS application_payment_status
                FROM payment_transactions pt

                JOIN brand_applications ba
                    ON ba.id = pt.application_id

                WHERE pt.reference = ?
            `).get(reference);

        if (!transaction) {

            return res.status(404).json({
                error:
                    "Payment transaction not found."
            });
        }

        /*
         * IMPORTANT:
         *
         * The browser cannot mark a transaction
         * as paid simply by sending:
         *
         * payment_status = "paid"
         *
         * Only the server-side transaction record
         * is trusted.
         *
         * With a real bank, this section must call
         * the bank server/API or process its webhook.
         */

        const verified =
            transaction.status === "paid" &&
            transaction.application_payment_status === "paid";

        res.json({

            verified,

            status:
                transaction.status,

            transaction_id:
                transaction.id,

            application_id:
                transaction.application_id,

            provider:
                transaction.provider
        });
    }
);

/* =========================================================
   ADMIN AUTH
========================================================= */

function requireAdmin(
    req,
    res,
    next
) {

    const adminUser =
        process.env.ADMIN_USER;

    const adminPassword =
        process.env.ADMIN_PASSWORD;

    if (
        !adminUser ||
        !adminPassword
    ) {

        return res.status(503).send(
            "Admin authentication is not configured."
        );
    }

    const header =
        req.headers.authorization;

    if (!header) {

        res.set(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS Admin"'
        );

        return res.status(401).send(
            "Authentication required."
        );
    }

    const parts =
        header.split(" ");

    if (
        parts.length !== 2 ||
        parts[0].toLowerCase() !== "basic"
    ) {

        res.set(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS Admin"'
        );

        return res.status(401).send(
            "Invalid authentication."
        );
    }

    let decoded;

    try {

        decoded =
            Buffer
                .from(
                    parts[1],
                    "base64"
                )
                .toString("utf8");

    } catch {

        return res.status(401).send(
            "Invalid authentication."
        );
    }

    const separator =
        decoded.indexOf(":");

    if (separator < 0) {

        return res.status(401).send(
            "Invalid authentication."
        );
    }

    const suppliedUser =
        decoded.slice(
            0,
            separator
        );

    const suppliedPassword =
        decoded.slice(
            separator + 1
        );

    if (
        suppliedUser !== adminUser ||
        suppliedPassword !== adminPassword
    ) {

        res.set(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS Admin"'
        );

        return res.status(401).send(
            "Invalid credentials."
        );
    }

    next();
}

/* =========================================================
   ADMIN — APPLICATIONS
========================================================= */

app.get(
    "/api/admin/applications",
    requireAdmin,
    (req, res) => {

        const applications =
            db.prepare(`
                SELECT
                    a.*,
                    c.name AS country_name,
                    c.code AS country_code

                FROM brand_applications a

                JOIN countries c
                    ON c.id = a.country_id

                ORDER BY
                    a.created_at DESC
            `).all();

        res.json(
            applications
        );
    }
);

/* =========================================================
   ADMIN — CREATE BRAND
========================================================= */

app.post(
    "/api/admin/brands",
    requireAdmin,
    (req, res) => {

        try {

            const countryId =
                safeInteger(
                    req.body.country_id
                );

            const name =
                cleanText(
                    req.body.name ||
                    req.body.brand_name,
                    150
                );

            const logo =
                safeUrl(
                    req.body.logo
                );

            const website =
                safeUrl(
                    req.body.website
                );

            const description =
                cleanText(
                    req.body.description,
                    3000
                );

            if (
                !countryId ||
                !name
            ) {

                return res.status(400).json({
                    error:
                        "Country and brand name are required."
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
                    error:
                        "Country or territory not found."
                });
            }

            const existing =
                db.prepare(`
                    SELECT id
                    FROM brands
                    WHERE name = ?
                    AND country_id = ?
                `).get(
                    name,
                    countryId
                );

            if (existing) {

                return res.status(409).json({
                    error:
                        "This brand already exists in this country or territory."
                });
            }

            const slug =
                uniqueSlug(
                    "brands",
                    name
                );

            const result =
                db.prepare(`
                    INSERT INTO brands
                    (
                        country_id,
                        name,
                        slug,
                        logo,
                        website,
                        description
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    countryId,
                    name,
                    slug,
                    logo,
                    website,
                    description
                );

            res.status(201).json({
                success: true,
                id:
                    Number(
                        result.lastInsertRowid
                    ),
                slug
            });

        } catch (error) {

            console.error(
                "ADMIN BRAND ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not create brand."
            });
        }
    }
);

/* =========================================================
   ADMIN — DELETE STARTER BRANDS
========================================================= */

app.delete(
    "/api/admin/remove-starter-brands",
    requireAdmin,
    (req, res) => {

        const oldStarterBrands = [
            "Apple",
            "Microsoft",
            "Nike",
            "Coca-Cola",
            "BMW",
            "Mercedes-Benz",
            "Adidas",
            "Toyota",
            "Samsung",
            "Huawei",
            "L'Oréal",
            "Ferrari",
            "Arçelik",
            "Artel",
            "Tata"
        ];

        const placeholders =
            oldStarterBrands
                .map(() => "?")
                .join(",");

        const result =
            db.prepare(`
                DELETE FROM brands
                WHERE name IN (${placeholders})
            `).run(
                ...oldStarterBrands
            );

        res.json({
            success: true,
            deleted:
                result.changes
        });
    }
);

/* =========================================================
   ADMIN — DELETE BRAND
========================================================= */

app.delete(
    "/api/admin/brands/:id",
    requireAdmin,
    (req, res) => {

        const id =
            safeInteger(
                req.params.id
            );

        if (!id) {

            return res.status(400).json({
                error:
                    "Invalid brand ID."
            });
        }

        const result =
            db.prepare(`
                DELETE FROM brands
                WHERE id = ?
            `).run(id);

        if (!result.changes) {

            return res.status(404).json({
                error:
                    "Brand not found."
            });
        }

        res.json({
            success: true
        });
    }
);

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        /*
         * FIX:
         *
         * admin.html is expected inside /public.
         */
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.html"
            )
        );
    }
);

/* =========================================================
   LEGAL PAGES
========================================================= */

const legalPages = {

    "/legal/offer": {

        title:
            "Public Offer — ALL WORLD BRANDS",

        heading:
            "Public Offer",

        text: `
<h2>Public Offer</h2>

<p>
This Public Offer governs the use of paid brand
submission services provided by ALL WORLD BRANDS.
</p>

<h3>1. Service</h3>

<p>
ALL WORLD BRANDS provides a digital directory service
for submitting company and brand information.
</p>

<h3>2. Service Price</h3>

<p>
The standard brand submission service fee is
<strong>$1 USD</strong>.
</p>

<h3>3. Payment</h3>

<p>
Payment must be successfully confirmed by the
payment provider before a paid submission can be
processed.
</p>

<h3>4. Payment Verification</h3>

<p>
Payment status is verified by the server. When a real
acquiring provider is connected, verification must be
performed through server-to-server communication or
an authenticated provider webhook.
</p>

<h3>5. Content</h3>

<p>
Submitted information must be accurate, lawful and
must not infringe third-party rights.
</p>

<h3>6. Acceptance</h3>

<p>
Submitting an application and completing payment means
that the customer accepts this Public Offer.
</p>
`
    },

    "/legal/privacy": {

        title:
            "Privacy Policy — ALL WORLD BRANDS",

        heading:
            "Privacy Policy",

        text: `
<h2>Privacy Policy</h2>

<p>
ALL WORLD BRANDS respects the privacy of visitors,
customers and brand representatives.
</p>

<h3>Information We May Collect</h3>

<p>
We may collect information necessary to process a
brand application, including brand name, country,
contact name, email address, phone number, website
and description.
</p>

<h3>Payment Information</h3>

<p>
Payment card details should be processed by the
authorized payment provider. ALL WORLD BRANDS should
not store full card numbers or CVV codes on its own
server.
</p>

<h3>Use of Information</h3>

<p>
Information may be used to process applications,
communicate with customers, prevent abuse and
operate the directory.
</p>

<h3>Security</h3>

<p>
Reasonable technical and organizational measures are
used to protect submitted information.
</p>

<h3>Contact</h3>

<p>
For privacy questions, contact:
allworldbrandsnet@gmail.com
</p>
`
    },

    "/legal/payment-refund": {

        title:
            "Payment & Refund Policy — ALL WORLD BRANDS",

        heading:
            "Payment & Refund Policy",

        text: `
<h2>Payment & Refund Policy</h2>

<h3>Payment</h3>

<p>
The standard brand submission fee is
<strong>$1 USD</strong>.
</p>

<h3>Payment Processing</h3>

<p>
Payments are processed through the available
acquiring/payment provider. Until a real acquiring
connection is activated, the website may operate
in demo payment mode.
</p>

<h3>Refunds</h3>

<p>
If a payment was successfully charged but the
corresponding service cannot reasonably be provided,
the customer may contact ALL WORLD BRANDS for review.
</p>

<h3>Fraudulent or Unauthorized Payments</h3>

<p>
Suspected unauthorized transactions may be reviewed
and reported to the relevant payment provider.
</p>
`
    },

    "/legal/terms": {

        title:
            "Terms of Use — ALL WORLD BRANDS",

        heading:
            "Terms of Use",

        text: `
<h2>Terms of Use</h2>

<h3>1. Website Use</h3>

<p>
You may use ALL WORLD BRANDS only for lawful purposes.
</p>

<h3>2. Submitted Content</h3>

<p>
You are responsible for the accuracy and legality of
information you submit.
</p>

<h3>3. Prohibited Content</h3>

<p>
Users must not submit illegal, fraudulent, abusive,
malicious or infringing content.
</p>

<h3>4. Moderation</h3>

<p>
ALL WORLD BRANDS may review, reject, edit or remove
submissions that violate these Terms or applicable law.
</p>

<h3>5. Availability</h3>

<p>
The website may be updated, modified or temporarily
unavailable for maintenance or technical reasons.
</p>

<h3>6. Contact</h3>

<p>
allworldbrandsnet@gmail.com
</p>
`
    },

    "/legal/contact": {

        title:
            "Legal & Contact — ALL WORLD BRANDS",

        heading:
            "Legal & Contact",

        text: `
<h2>Legal & Contact</h2>

<p>
<strong>Website:</strong>
ALL WORLD BRANDS
</p>

<p>
<strong>Website:</strong>
${htmlEscape(SITE_URL)}
</p>

<p>
<strong>Email:</strong>
allworldbrandsnet@gmail.com
</p>

<p>
<strong>Phone:</strong>
+998933843112
</p>

<p>
For legal, privacy, payment or service questions,
please contact us by email.
</p>
`
    }
};

for (
    const [
        route,
        page
    ] of Object.entries(
        legalPages
    )
) {

    app.get(
        route,
        (req, res) => {

            res.send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0"
>

<title>
${htmlEscape(page.title)}
</title>

<meta
name="robots"
content="index,follow"
>

<style>

body{

    margin:0;

    background:#02050c;

    color:#fff;

    font-family:
        Inter,
        Arial,
        sans-serif;

    line-height:1.7;
}

main{

    width:
        min(
            850px,
            calc(100% - 30px)
        );

    margin:60px auto;

    padding:35px;

    background:
        rgba(7,19,38,.92);

    border:
        1px solid
        rgba(255,255,255,.12);

    border-radius:20px;
}

h1{
    margin-top:0;
}

h2,
h3{
    color:#80d5ff;
}

a{
    color:#80d5ff;
}

</style>

</head>

<body>

<main>

<h1>
${htmlEscape(page.heading)}
</h1>

${page.text}

<hr
style="
border:0;
border-top:
1px solid
rgba(255,255,255,.1);
margin:30px 0;
"
>

<p>
<a href="/">
← Back to ALL WORLD BRANDS
</a>
</p>

</main>

</body>

</html>
            `);
        }
    );
}

/* =========================================================
   SEO — ROBOTS
========================================================= */

app.get(
    "/robots.txt",
    (req, res) => {

        res.type(
            "text/plain"
        );

        res.send(
`User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml`
        );
    }
);

/* =========================================================
   SEO — SITEMAP
========================================================= */

app.get(
    "/sitemap.xml",
    (req, res) => {

        const countryRows =
            db.prepare(`
                SELECT id
                FROM countries
            `).all();

        const brandRows =
            db.prepare(`
                SELECT id
                FROM brands
            `).all();

        const urls = [
            `${SITE_URL}/`,
            `${SITE_URL}/legal/offer`,
            `${SITE_URL}/legal/privacy`,
            `${SITE_URL}/legal/payment-refund`,
            `${SITE_URL}/legal/terms`,
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

${urls.map(url => `
<url>
<loc>${htmlEscape(url)}</loc>
</url>
`).join("")}

</urlset>`;

        res.type(
            "application/xml"
        );

        res.send(xml);
    }
);

/* =========================================================
   COUNTRY PAGE
========================================================= */

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

/* =========================================================
   BRAND PAGE
========================================================= */

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
   HOME
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

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        try {

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

                site:
                    "ALL WORLD BRANDS",

                countries:
                    countryCount,

                brands:
                    brandCount,

                applications:
                    applicationCount,

                payment:
                    DEMO_ACQUIRING
                        ? "demo_acquiring"
                        : "bank_acquiring",

                submission_price:
                    SUBMISSION_AMOUNT,

                currency:
                    SUBMISSION_CURRENCY
            });

        } catch (error) {

            console.error(
                "HEALTH ERROR:",
                error
            );

            res.status(500).json({
                ok: false,
                error:
                    "Health check failed."
            });
        }
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
                    "Not found."
            });
        }

        res.status(404).send(
            "Page not found."
        );
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).json({
            error:
                "Internal server error."
        });
    }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "ALL WORLD BRANDS"
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Site: ${SITE_URL}`
        );

        console.log(
            `Database: ${DB_FILE}`
        );

        console.log(
            `Payment mode: ${
                DEMO_ACQUIRING
                    ? "DEMO ACQUIRING"
                    : "BANK ACQUIRING"
            }`
        );

        console.log(
            `Submission price: ${SUBMISSION_AMOUNT} ${SUBMISSION_CURRENCY}`
        );

        console.log(
            "========================================"
        );
    }
);
