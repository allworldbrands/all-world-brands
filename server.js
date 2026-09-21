const express = require("express");
const path = require("path");
const crypto = require("crypto");
const helmet = require("helmet");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const PORT = process.env.PORT || 3000;

const PUBLIC_BASE_URL = (
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net"
).replace(/\/+$/, "");

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "allworldbrands.db");

/* =========================================================
   OCTO PAYMENT
========================================================= */

const OCTO_SHOP_ID =
    process.env.OCTO_SHOP_ID || "43051";

const OCTO_SECRET =
    process.env.OCTO_SECRET || "";

const OCTO_UNIQUE_KEY =
    process.env.OCTO_UNIQUE_KEY || "";

const OCTO_TEST =
    String(process.env.OCTO_TEST || "false")
        .toLowerCase() === "true";

const OCTO_LANGUAGE =
    process.env.OCTO_LANGUAGE || "en";

const BRAND_APPLICATION_AMOUNT =
    Number(process.env.BRAND_APPLICATION_AMOUNT || 1);

const BRAND_APPLICATION_CURRENCY =
    String(
        process.env.BRAND_APPLICATION_CURRENCY || "USD"
    ).toUpperCase();

const OCTO_TTL_MINUTES = 15;

/* =========================================================
   SITE
========================================================= */

const SITE_NAME =
    process.env.SITE_NAME ||
    "ALL WORLD BRANDS";

const SITE_TAGLINE =
    process.env.SITE_TAGLINE ||
    "Bring your brand to the world.";

const CONTACT_EMAIL =
    process.env.CONTACT_EMAIL ||
    "allworldbrandsnet@gmail.com";

const CONTACT_PHONE =
    process.env.CONTACT_PHONE ||
    "+998 93 384 31 12";

const CONTACT_WHATSAPP =
    process.env.CONTACT_WHATSAPP ||
    "+998 93 384 31 12";

const CONTACT_TELEGRAM =
    process.env.CONTACT_TELEGRAM ||
    "@allworldbrandsnet";

/* =========================================================
   DATABASE
========================================================= */

const appDb = new sqlite3.Database(DB_FILE);

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(morgan("combined"));

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

appDb.run("PRAGMA foreign_keys = ON");

/* =========================================================
   DATABASE HELPERS
========================================================= */

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        appDb.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        appDb.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        appDb.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows || []);
        });
    });
}

async function addColumnIfMissing(
    table,
    column,
    definition
) {
    const columns = await dbAll(
        `PRAGMA table_info(${table})`
    );

    const exists = columns.some(
        c => c.name === column
    );

    if (!exists) {
        await dbRun(
            `ALTER TABLE ${table}
             ADD COLUMN ${column} ${definition}`
        );
    }
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

function normalizeText(value, max = 1000) {
    return String(value || "")
        .trim()
        .slice(0, max);
}

function normalizeEmail(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .slice(0, 200);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSafeUrl(value) {
    const url = String(value || "").trim();

    if (!url) {
        return true;
    }

    if (url.length > 2048) {
        return false;
    }

    if (
        /^javascript:/i.test(url) ||
        /^data:/i.test(url) ||
        /^vbscript:/i.test(url) ||
        /^file:/i.test(url) ||
        /^blob:/i.test(url)
    ) {
        return false;
    }

    if (
        url.startsWith("/") ||
        url.startsWith("./")
    ) {
        return true;
    }

    try {
        const parsed = new URL(url);

        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        );
    } catch {
        return false;
    }
}

/* =========================================================
   CONTENT MODERATION
========================================================= */

function normalizeForModeration(value) {
    return String(value || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

const ADULT_CONTENT_WORDS = [
    "porn",
    "porno",
    "pornography",
    "pornographic",
    "xxx",
    "nsfw",
    "sexvideo",
    "sexualvideo",
    "adultvideo",
    "adultcontent",
    "onlyfans"
];

function containsAdultContent(value) {
    const normalized =
        normalizeForModeration(value);

    return ADULT_CONTENT_WORDS.some(word =>
        normalized.includes(word)
    );
}

function isBlockedContent(...values) {
    return values.some(value =>
        containsAdultContent(value)
    );
}

/* =========================================================
   PAYMENT HELPERS
========================================================= */

function formatPaymentDisplay(
    amount,
    currency
) {
    const number = Number(amount);

    if (
        currency === "USD" &&
        Number.isFinite(number)
    ) {
        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: "USD",
                minimumFractionDigits:
                    Number.isInteger(number)
                        ? 0
                        : 2
            }
        ).format(number);
    }

    return `${number} ${currency}`;
}

function timingSafeEqualStrings(a, b) {
    const aa = Buffer.from(String(a || ""));
    const bb = Buffer.from(String(b || ""));

    if (aa.length !== bb.length) {
        return false;
    }

    return crypto.timingSafeEqual(aa, bb);
}

function moneyEquals(a, b) {
    return (
        Math.abs(
            Number(a) - Number(b)
        ) < 0.000001
    );
}

function octoConfigured() {
    return Boolean(
        OCTO_SHOP_ID &&
        OCTO_SECRET &&
        OCTO_UNIQUE_KEY
    );
}

function octoInitUrl() {
    return "https://secure.octo.uz/prepare_payment";
}

function octoStatusUrl() {
    return "https://secure.octo.uz/prepare_payment";
}

function makeOctoSignature(
    uuid,
    status
) {
    return crypto
        .createHash("sha1")
        .update(
            `${OCTO_UNIQUE_KEY}${uuid}${status}`,
            "utf8"
        )
        .digest("hex");
}

function parseOctoResponse(body) {
    if (!body) {
        return {
            error: 1,
            message: "Empty OCTO response"
        };
    }

    const data =
        body.data &&
        typeof body.data === "object"
            ? body.data
            : {};

    const error =
        body.error ??
        data.error ??
        0;

    const message =
        body.errMessage ||
        body.errorMessage ||
        data.errMessage ||
        data.errorMessage ||
        "";

    return {
        ...body,
        ...data,
        error,
        message
    };
}

async function octoRequest(payload) {
    const response = await fetch(
        octoInitUrl(),
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

    const text =
        await response.text();

    let json;

    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(
            `OCTO returned invalid JSON (${response.status})`
        );
    }

    if (!response.ok) {
        throw new Error(
            json.errMessage ||
            json.errorMessage ||
            `OCTO HTTP ${response.status}`
        );
    }

    return parseOctoResponse(json);
}

async function getOctoPaymentStatus(
    transactionId
) {
    if (!octoConfigured()) {
        throw new Error(
            "OCTO is not configured"
        );
    }

    const payload = {
        octo_shop_id:
            OCTO_SHOP_ID,

        octo_secret:
            OCTO_SECRET,

        shop_transaction_id:
            String(transactionId)
    };

    const response = await fetch(
        octoStatusUrl(),
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

    const text =
        await response.text();

    let json;

    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(
            "Invalid OCTO status response"
        );
    }

    return parseOctoResponse(json);
}

function extractOctoStatus(result) {
    const candidates = [
        result.status,
        result.payment_status,
        result.octo_status,
        result.data?.status,
        result.data?.payment_status
    ];

    for (const value of candidates) {
        if (
            value !== undefined &&
            value !== null &&
            String(value).trim()
        ) {
            return String(value)
                .trim()
                .toLowerCase();
        }
    }

    return "";
}

function extractOctoAmount(result) {
    const candidates = [
        result.total_sum,
        result.amount,
        result.data?.total_sum,
        result.data?.amount
    ];

    for (const value of candidates) {
        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            return Number(value);
        }
    }

    return null;
}

function extractOctoCurrency(result) {
    const candidates = [
        result.currency,
        result.data?.currency
    ];

    for (const value of candidates) {
        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            return String(value)
                .trim()
                .toUpperCase();
        }
    }

    return "";
}

function isOctoPaidStatus(status) {
    return [
        "paid",
        "success",
        "succeeded",
        "captured",
        "completed",
        "payment_success"
    ].includes(
        String(status || "").toLowerCase()
    );
}

function isOctoFailedStatus(status) {
    return [
        "failed",
        "cancelled",
        "canceled",
        "expired",
        "rejected"
    ].includes(
        String(status || "").toLowerCase()
    );
}

function currentOctoTime() {
    const d = new Date();

    const pad = n =>
        String(n).padStart(2, "0");

    return (
        `${d.getFullYear()}-` +
        `${pad(d.getMonth() + 1)}-` +
        `${pad(d.getDate())} ` +
        `${pad(d.getHours())}:` +
        `${pad(d.getMinutes())}:` +
        `${pad(d.getSeconds())}`
    );
}

/* =========================================================
   LANGUAGE
========================================================= */

const COUNTRY_LANGUAGE_MAP = {
    UZ: "uz",
    TR: "tr",
    GB: "en",
    US: "en",
    CA: "en",
    AU: "en",
    NZ: "en",

    DE: "de",
    AT: "de",
    CH: "de",

    FR: "fr",
    BE: "fr",

    ES: "es",
    IT: "it",
    PT: "pt",
    BR: "pt",

    RU: "ru",
    UA: "uk",
    BY: "be",

    KZ: "kk",
    KG: "ky",
    AZ: "az",
    GE: "ka",
    TJ: "tg",
    TM: "tk",

    CN: "zh",
    TW: "zh",
    HK: "zh",

    JP: "ja",
    KR: "ko",

    IN: "en",

    AE: "ar",
    SA: "ar",
    QA: "ar",
    KW: "ar",
    BH: "ar",
    OM: "ar",
    JO: "ar",
    IQ: "ar",
    EG: "ar",
    MA: "ar",
    TN: "ar",

    IR: "fa",
    IL: "he"
};

/* =========================================================
   COUNTRIES + TERRITORIES
========================================================= */

const COUNTRIES = [

    ["Afghanistan", "AF"],
    ["Albania", "AL"],
    ["Algeria", "DZ"],
    ["Andorra", "AD"],
    ["Angola", "AO"],
    ["Antigua and Barbuda", "AG"],
    ["Argentina", "AR"],
    ["Armenia", "AM"],
    ["Australia", "AU"],
    ["Austria", "AT"],
    ["Azerbaijan", "AZ"],

    ["Bahamas", "BS"],
    ["Bahrain", "BH"],
    ["Bangladesh", "BD"],
    ["Barbados", "BB"],
    ["Belarus", "BY"],
    ["Belgium", "BE"],
    ["Belize", "BZ"],
    ["Benin", "BJ"],
    ["Bhutan", "BT"],
    ["Bolivia", "BO"],
    ["Bosnia and Herzegovina", "BA"],
    ["Botswana", "BW"],
    ["Brazil", "BR"],
    ["Brunei", "BN"],
    ["Bulgaria", "BG"],
    ["Burkina Faso", "BF"],
    ["Burundi", "BI"],

    ["Cabo Verde", "CV"],
    ["Cambodia", "KH"],
    ["Cameroon", "CM"],
    ["Canada", "CA"],
    ["Central African Republic", "CF"],
    ["Chad", "TD"],
    ["Chile", "CL"],
    ["China", "CN"],
    ["Colombia", "CO"],
    ["Comoros", "KM"],
    ["Congo", "CG"],
    ["Costa Rica", "CR"],
    ["Côte d'Ivoire", "CI"],
    ["Croatia", "HR"],
    ["Cuba", "CU"],
    ["Cyprus", "CY"],
    ["Czechia", "CZ"],

    ["Democratic Republic of the Congo", "CD"],
    ["Denmark", "DK"],
    ["Djibouti", "DJ"],
    ["Dominica", "DM"],
    ["Dominican Republic", "DO"],

    ["Ecuador", "EC"],
    ["Egypt", "EG"],
    ["El Salvador", "SV"],
    ["Equatorial Guinea", "GQ"],
    ["Eritrea", "ER"],
    ["Estonia", "EE"],
    ["Eswatini", "SZ"],
    ["Ethiopia", "ET"],

    ["Fiji", "FJ"],
    ["Finland", "FI"],
    ["France", "FR"],

    ["Gabon", "GA"],
    ["Gambia", "GM"],
    ["Georgia", "GE"],
    ["Germany", "DE"],
    ["Ghana", "GH"],
    ["Greece", "GR"],
    ["Grenada", "GD"],
    ["Guatemala", "GT"],
    ["Guinea", "GN"],
    ["Guinea-Bissau", "GW"],
    ["Guyana", "GY"],

    ["Haiti", "HT"],
    ["Honduras", "HN"],
    ["Hungary", "HU"],

    ["Iceland", "IS"],
    ["India", "IN"],
    ["Indonesia", "ID"],
    ["Iran", "IR"],
    ["Iraq", "IQ"],
    ["Ireland", "IE"],
    ["Israel", "IL"],
    ["Italy", "IT"],

    ["Jamaica", "JM"],
    ["Japan", "JP"],
    ["Jordan", "JO"],

    ["Kazakhstan", "KZ"],
    ["Kenya", "KE"],
    ["Kiribati", "KI"],
    ["Kuwait", "KW"],
    ["Kyrgyzstan", "KG"],

    ["Laos", "LA"],
    ["Latvia", "LV"],
    ["Lebanon", "LB"],
    ["Lesotho", "LS"],
    ["Liberia", "LR"],
    ["Libya", "LY"],
    ["Liechtenstein", "LI"],
    ["Lithuania", "LT"],
    ["Luxembourg", "LU"],

    ["Madagascar", "MG"],
    ["Malawi", "MW"],
    ["Malaysia", "MY"],
    ["Maldives", "MV"],
    ["Mali", "ML"],
    ["Malta", "MT"],
    ["Marshall Islands", "MH"],
    ["Mauritania", "MR"],
    ["Mauritius", "MU"],
    ["Mexico", "MX"],
    ["Micronesia", "FM"],
    ["Moldova", "MD"],
    ["Monaco", "MC"],
    ["Mongolia", "MN"],
    ["Montenegro", "ME"],
    ["Morocco", "MA"],
    ["Mozambique", "MZ"],
    ["Myanmar", "MM"],

    ["Namibia", "NA"],
    ["Nauru", "NR"],
    ["Nepal", "NP"],
    ["Netherlands", "NL"],
    ["New Zealand", "NZ"],
    ["Nicaragua", "NI"],
    ["Niger", "NE"],
    ["Nigeria", "NG"],
    ["North Korea", "KP"],
    ["North Macedonia", "MK"],
    ["Norway", "NO"],

    ["Oman", "OM"],

    ["Pakistan", "PK"],
    ["Palau", "PW"],
    ["Palestine", "PS"],
    ["Panama", "PA"],
    ["Papua New Guinea", "PG"],
    ["Paraguay", "PY"],
    ["Peru", "PE"],
    ["Philippines", "PH"],
    ["Poland", "PL"],
    ["Portugal", "PT"],

    ["Qatar", "QA"],

    ["Romania", "RO"],
    ["Russia", "RU"],
    ["Rwanda", "RW"],

    ["Saint Kitts and Nevis", "KN"],
    ["Saint Lucia", "LC"],
    ["Saint Vincent and the Grenadines", "VC"],
    ["Samoa", "WS"],
    ["San Marino", "SM"],
    ["Sao Tome and Principe", "ST"],
    ["Saudi Arabia", "SA"],
    ["Senegal", "SN"],
    ["Serbia", "RS"],
    ["Seychelles", "SC"],
    ["Sierra Leone", "SL"],
    ["Singapore", "SG"],
    ["Slovakia", "SK"],
    ["Slovenia", "SI"],
    ["Solomon Islands", "SB"],
    ["Somalia", "SO"],
    ["South Africa", "ZA"],
    ["South Korea", "KR"],
    ["South Sudan", "SS"],
    ["Spain", "ES"],
    ["Sri Lanka", "LK"],
    ["Sudan", "SD"],
    ["Suriname", "SR"],
    ["Sweden", "SE"],
    ["Switzerland", "CH"],
    ["Syria", "SY"],

    ["Taiwan", "TW"],
    ["Tajikistan", "TJ"],
    ["Tanzania", "TZ"],
    ["Thailand", "TH"],
    ["Timor-Leste", "TL"],
    ["Togo", "TG"],
    ["Tonga", "TO"],
    ["Trinidad and Tobago", "TT"],
    ["Tunisia", "TN"],
    ["Turkey", "TR"],
    ["Turkmenistan", "TM"],
    ["Tuvalu", "TV"],

    ["Uganda", "UG"],
    ["Ukraine", "UA"],
    ["United Arab Emirates", "AE"],
    ["United Kingdom", "GB"],
    ["United States", "US"],
    ["Uruguay", "UY"],
    ["Uzbekistan", "UZ"],

    ["Vanuatu", "VU"],
    ["Vatican City", "VA"],
    ["Venezuela", "VE"],
    ["Vietnam", "VN"],

    ["Yemen", "YE"],

    ["Zambia", "ZM"],
    ["Zimbabwe", "ZW"],

    ["Åland Islands", "AX"],
    ["American Samoa", "AS"],
    ["Anguilla", "AI"],
    ["Aruba", "AW"],
    ["Bermuda", "BM"],
    ["Bonaire, Sint Eustatius and Saba", "BQ"],
    ["Cayman Islands", "KY"],
    ["Curaçao", "CW"],
    ["Falkland Islands", "FK"],
    ["Faroe Islands", "FO"],
    ["French Polynesia", "PF"],
    ["Gibraltar", "GI"],
    ["Greenland", "GL"],
    ["Guam", "GU"],
    ["Guernsey", "GG"],
    ["Hong Kong", "HK"],
    ["Isle of Man", "IM"],
    ["Jersey", "JE"],
    ["Macao", "MO"],
    ["Montserrat", "MS"],
    ["New Caledonia", "NC"],
    ["Northern Mariana Islands", "MP"],
    ["Puerto Rico", "PR"],
    ["Réunion", "RE"],
    ["Saint Barthélemy", "BL"],
    ["Saint Helena", "SH"],
    ["Saint Martin", "MF"],
    ["Saint Pierre and Miquelon", "PM"],
    ["Sint Maarten", "SX"],
    ["Tokelau", "TK"],
    ["Turks and Caicos Islands", "TC"],
    ["United States Virgin Islands", "VI"],
    ["British Virgin Islands", "VG"],
    ["Wallis and Futuna", "WF"],
    ["Western Sahara", "EH"]
];

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {

    await dbRun(`
        CREATE TABLE IF NOT EXISTS countries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            code TEXT
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS brands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            logo TEXT DEFAULT '',
            category TEXT DEFAULT '',
            description TEXT DEFAULT '',
            website TEXT DEFAULT '',
            verification TEXT DEFAULT 'Unverified',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY(country_id)
                REFERENCES countries(id)
                ON DELETE CASCADE
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS factories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_id INTEGER,
            name TEXT,
            city TEXT,
            address TEXT,
            phone TEXT,
            website TEXT,

            FOREIGN KEY(brand_id)
                REFERENCES brands(id)
                ON DELETE CASCADE
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            brand_name TEXT NOT NULL,
            country TEXT,
            owner_name TEXT,
            email TEXT,
            phone TEXT,
            website TEXT,
            logo TEXT DEFAULT '',
            description TEXT,

            status TEXT DEFAULT 'new',

            payment_status TEXT DEFAULT 'unpaid',
            payment_amount REAL DEFAULT 1,
            payment_currency TEXT DEFAULT 'USD',

            octo_transaction_id TEXT,
            octo_payment_uuid TEXT,
            octo_payment_url TEXT,
            octo_created_at DATETIME,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await addColumnIfMissing(
        "applications",
        "payment_status",
        "TEXT DEFAULT 'unpaid'"
    );

    await addColumnIfMissing(
        "applications",
        "payment_amount",
        "REAL DEFAULT 1"
    );

    await addColumnIfMissing(
        "applications",
        "payment_currency",
        "TEXT DEFAULT 'USD'"
    );

    await addColumnIfMissing(
        "applications",
        "octo_transaction_id",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "octo_payment_uuid",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "octo_payment_url",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "octo_created_at",
        "DATETIME"
    );

    await addColumnIfMissing(
        "applications",
        "updated_at",
        "DATETIME"
    );

    for (const [name, code] of COUNTRIES) {

        await dbRun(
            `
            INSERT OR IGNORE INTO countries
            (
                name,
                code
            )
            VALUES (?, ?)
            `,
            [name, code]
        );
    }

    const starterBrands = [

        [
            "Apple",
            "US",
            "",
            "Technology",
            "Apple products and technology.",
            "https://www.apple.com"
        ],

        [
            "Nike",
            "US",
            "",
            "Sportswear",
            "Sportswear and footwear.",
            "https://www.nike.com"
        ],

        [
            "Burberry",
            "GB",
            "",
            "Fashion",
            "British luxury fashion brand.",
            "https://www.burberry.com"
        ],

        [
            "BMW",
            "DE",
            "",
            "Automotive",
            "German automotive brand.",
            "https://www.bmw.com"
        ],

        [
            "L'Oréal",
            "FR",
            "",
            "Beauty",
            "French beauty company.",
            "https://www.loreal.com"
        ],

        [
            "Ferrari",
            "IT",
            "",
            "Automotive",
            "Italian automotive brand.",
            "https://www.ferrari.com"
        ],

        [
            "Arçelik",
            "TR",
            "",
            "Home Appliances",
            "Turkish home appliance brand.",
            "https://www.arcelik.com.tr"
        ],

        [
            "Artel",
            "UZ",
            "",
            "Electronics",
            "Uzbek electronics brand.",
            "https://artelgroup.org"
        ],

        [
            "Toyota",
            "JP",
            "",
            "Automotive",
            "Japanese automotive brand.",
            "https://www.toyota.com"
        ],

        [
            "Samsung",
            "KR",
            "",
            "Technology",
            "South Korean technology brand.",
            "https://www.samsung.com"
        ],

        [
            "Huawei",
            "CN",
            "",
            "Technology",
            "Technology and telecommunications brand.",
            "https://www.huawei.com"
        ],

        [
            "Tata",
            "IN",
            "",
            "Conglomerate",
            "Indian business group.",
            "https://www.tata.com"
        ]
    ];

    for (const brand of starterBrands) {

        const [
            name,
            code,
            logo,
            category,
            description,
            website
        ] = brand;

        const country =
            await dbGet(
                `
                SELECT id
                FROM countries
                WHERE code = ?
                LIMIT 1
                `,
                [code]
            );

        if (!country) {
            continue;
        }

        const exists =
            await dbGet(
                `
                SELECT id
                FROM brands
                WHERE name = ?
                AND country_id = ?
                LIMIT 1
                `,
                [
                    name,
                    country.id
                ]
            );

        if (!exists) {

            await dbRun(
                `
                INSERT INTO brands
                (
                    country_id,
                    name,
                    logo,
                    category,
                    description,
                    website,
                    verification
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    country.id,
                    name,
                    logo,
                    category,
                    description,
                    website,
                    "Verified"
                ]
            );
        }
    }

    console.log(
        `Database initialized with ${COUNTRIES.length} country/territory records.`
    );
}

/* =========================================================
   ADMIN AUTH
========================================================= */

function adminAuth(
    req,
    res,
    next
) {

    const user =
        process.env.ADMIN_USER || "";

    const password =
        process.env.ADMIN_PASSWORD || "";

    if (!user || !password) {

        return res
            .status(503)
            .json({
                error:
                    "Admin credentials are not configured."
            });
    }

    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Basic ")) {

        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res
            .status(401)
            .send(
                "Authentication required."
            );
    }

    const encoded =
        header.slice(6);

    let decoded;

    try {

        decoded =
            Buffer
                .from(
                    encoded,
                    "base64"
                )
                .toString("utf8");

    } catch {

        return res
            .status(401)
            .send(
                "Invalid authentication."
            );
    }

    const separator =
        decoded.indexOf(":");

    const suppliedUser =
        separator >= 0
            ? decoded.slice(
                0,
                separator
            )
            : "";

    const suppliedPassword =
        separator >= 0
            ? decoded.slice(
                separator + 1
            )
            : "";

    if (
        suppliedUser !== user ||
        suppliedPassword !== password
    ) {

        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res
            .status(401)
            .send(
                "Invalid credentials."
            );
    }

    next();
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            ok: true,
            service:
                "ALL WORLD BRANDS",

            countries:
                COUNTRIES.length,

            payment: {
                provider:
                    "OCTO",

                configured:
                    octoConfigured()
            }
        });
    }
);

/* =========================================================
   SITE CONFIG
========================================================= */

app.get(
    "/api/site-config",
    (req, res) => {

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        res.json({

            name:
                SITE_NAME,

            tagline:
                SITE_TAGLINE,

            country_count:
                COUNTRIES.length,

            payment_amount:
                BRAND_APPLICATION_AMOUNT,

            payment_currency:
                BRAND_APPLICATION_CURRENCY,

            payment_display:
                formatPaymentDisplay(
                    BRAND_APPLICATION_AMOUNT,
                    BRAND_APPLICATION_CURRENCY
                ),

            contact: {

                phone:
                    CONTACT_PHONE,

                whatsapp:
                    CONTACT_WHATSAPP,

                telegram:
                    CONTACT_TELEGRAM,

                email:
                    CONTACT_EMAIL
            },

            default_language:
                "en"
        });
    }
);

/* =========================================================
   LANGUAGE
========================================================= */

app.get(
    "/api/language",
    (req, res) => {

        const country =
            String(
                req.query.country || ""
            )
                .trim()
                .toUpperCase();

        if (
            country &&
            COUNTRY_LANGUAGE_MAP[country]
        ) {

            return res.json({

                language:
                    COUNTRY_LANGUAGE_MAP[country],

                country
            });
        }

        const accepted =
            String(
                req.headers[
                    "accept-language"
                ] || ""
            );

        const language =
            accepted
                .split(",")[0]
                .split("-")[0]
                .toLowerCase() ||
            "en";

        res.json({

            language,

            country:
                country || null
        });
    }
);

/* =========================================================
   COUNTRIES
========================================================= */

app.get(
    "/api/countries",
    async (req, res) => {

        try {

            const rows =
                await dbAll(
                    `
                    SELECT
                        c.id,
                        c.name,
                        c.code,
                        COUNT(b.id)
                            AS brand_count

                    FROM countries c

                    LEFT JOIN brands b
                        ON b.country_id =
                           c.id

                    GROUP BY c.id

                    ORDER BY
                        c.name
                        COLLATE NOCASE
                    `
                );

            res.json(rows);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Unable to load countries."
            });
        }
    }
);

/* =========================================================
   BRANDS BY COUNTRY
========================================================= */

app.get(
    "/api/countries/:id/brands",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(id)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid country ID."
                    });
            }

            const rows =
                await dbAll(
                    `
                    SELECT
                        b.*,

                        c.name
                            AS country_name,

                        c.code
                            AS country_code

                    FROM brands b

                    JOIN countries c
                        ON c.id =
                           b.country_id

                    WHERE
                        b.country_id = ?

                    ORDER BY
                        b.name
                        COLLATE NOCASE
                    `,
                    [id]
                );

            res.json(rows);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Unable to load brands."
            });
        }
    }
);

/* =========================================================
   SINGLE BRAND
========================================================= */

app.get(
    "/api/brands/:id",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(id)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid brand ID."
                    });
            }

            const brand =
                await dbGet(
                    `
                    SELECT
                        b.*,

                        c.name
                            AS country_name,

                        c.code
                            AS country_code

                    FROM brands b

                    JOIN countries c
                        ON c.id =
                           b.country_id

                    WHERE
                        b.id = ?

                    LIMIT 1
                    `,
                    [id]
                );

            if (!brand) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Brand not found."
                    });
            }

            const factories =
                await dbAll(
                    `
                    SELECT *
                    FROM factories
                    WHERE brand_id = ?
                    ORDER BY name
                    `,
                    [id]
                );

            res.json({
                ...brand,
                factories
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Unable to load brand."
            });
        }
    }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
    "/api/search",
    async (req, res) => {

        try {

            const q =
                normalizeText(
                    req.query.q,
                    100
                );

            if (!q) {
                return res.json([]);
            }

            const pattern =
                `%${q}%`;

            const rows =
                await dbAll(
                    `
                    SELECT
                        b.*,

                        c.name
                            AS country_name,

                        c.code
                            AS country_code

                    FROM brands b

                    JOIN countries c
                        ON c.id =
                           b.country_id

                    WHERE
                        b.name LIKE ?

                    ORDER BY
                        b.name
                        COLLATE NOCASE

                    LIMIT 100
                    `,
                    [pattern]
                );

            res.json(rows);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Search failed."
            });
        }
    }
);

/* =========================================================
   BRAND APPLICATION
========================================================= */

app.post(
    "/api/applications",
    async (req, res) => {

        try {

            const brandName =
                normalizeText(
                    req.body.brand_name,
                    120
                );

            const country =
                normalizeText(
                    req.body.country,
                    120
                );

            const ownerName =
                normalizeText(
                    req.body.owner_name,
                    120
                );

            const email =
                normalizeEmail(
                    req.body.email
                );

            const phone =
                normalizeText(
                    req.body.phone,
                    50
                );

            const website =
                normalizeText(
                    req.body.website,
                    2048
                );

            const logo =
                normalizeText(
                    req.body.logo,
                    2048
                );

            const description =
                normalizeText(
                    req.body.description,
                    3000
                );

            if (
                !brandName ||
                !country ||
                !ownerName ||
                !email
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Brand name, country, owner name and email are required."
                    });
            }

            if (
                !isValidEmail(email)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid email address."
                    });
            }

            if (
                !isSafeUrl(website) ||
                !isSafeUrl(logo)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid URL."
                    });
            }

            if (
                isBlockedContent(
                    brandName,
                    ownerName,
                    description,
                    website
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "This content is not allowed."
                    });
            }

            const countryRow =
                await dbGet(
                    `
                    SELECT
                        id,
                        name,
                        code

                    FROM countries

                    WHERE
                        name = ?
                        OR code = ?

                    LIMIT 1
                    `,
                    [
                        country,
                        country.toUpperCase()
                    ]
                );

            if (!countryRow) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Please select a valid country."
                    });
            }

            const result =
                await dbRun(
                    `
                    INSERT INTO applications
                    (
                        brand_name,
                        country,
                        owner_name,
                        email,
                        phone,
                        website,
                        logo,
                        description,
                        status,
                        payment_status,
                        payment_amount,
                        payment_currency,
                        created_at,
                        updated_at
                    )

                    VALUES
                    (
                        ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [
                        brandName,
                        countryRow.name,
                        ownerName,
                        email,
                        phone,
                        website,
                        logo,
                        description,

                        "new",
                        "unpaid",

                        BRAND_APPLICATION_AMOUNT,
                        BRAND_APPLICATION_CURRENCY
                    ]
                );

            res.status(201).json({

                ok: true,

                application_id:
                    result.lastID,

                payment_required:
                    true,

                payment_amount:
                    BRAND_APPLICATION_AMOUNT,

                payment_currency:
                    BRAND_APPLICATION_CURRENCY,

                payment_display:
                    formatPaymentDisplay(
                        BRAND_APPLICATION_AMOUNT,
                        BRAND_APPLICATION_CURRENCY
                    )
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Unable to create application."
            });
        }
    }
);

/* =========================================================
   CREATE OCTO PAYMENT
========================================================= */

app.post(
    "/api/payments/octo/create",
    async (req, res) => {

        try {

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            if (!octoConfigured()) {

                return res
                    .status(503)
                    .json({
                        error:
                            "OCTO is not configured on the server."
                    });
            }

            const applicationId =
                Number(
                    req.body.application_id
                );

            if (
                !Number.isInteger(
                    applicationId
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid application ID."
                    });
            }

            const application =
                await dbGet(
                    `
                    SELECT *
                    FROM applications
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [applicationId]
                );

            if (!application) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Application not found."
                    });
            }

            if (
                application.payment_status ===
                "paid"
            ) {

                return res.json({

                    ok: true,

                    already_paid:
                        true,

                    application_id:
                        applicationId
                });
            }

            const now =
                Date.now();

            if (
                application.octo_payment_url &&
                application.octo_created_at
            ) {

                const created =
                    new Date(
                        application.octo_created_at
                    ).getTime();

                const ageMinutes =
                    (
                        now - created
                    ) / 60000;

                if (
                    Number.isFinite(
                        ageMinutes
                    ) &&
                    ageMinutes <
                        OCTO_TTL_MINUTES
                ) {

                    return res.json({

                        ok: true,

                        application_id:
                            applicationId,

                        payment_url:
                            application.octo_payment_url,

                        octo_pay_url:
                            application.octo_payment_url
                    });
                }
            }

            const transactionId =
                `AWB-${applicationId}-${Date.now()}`;

            const returnUrl =
                `${PUBLIC_BASE_URL}/?payment=octo&application_id=${encodeURIComponent(applicationId)}`;

            const notifyUrl =
                `${PUBLIC_BASE_URL}/api/octo/notify`;

            const payload = {

                octo_shop_id:
                    OCTO_SHOP_ID,

                octo_secret:
                    OCTO_SECRET,

                shop_transaction_id:
                    transactionId,

                total_sum:
                    Number(
                        application.payment_amount ||
                        BRAND_APPLICATION_AMOUNT
                    ),

                currency:
                    application.payment_currency ||
                    BRAND_APPLICATION_CURRENCY,

                description:
                    `ALL WORLD BRANDS - Brand application #${applicationId}`,

                payment_methods: [
                    {
                        method:
                            "bank_card"
                    }
                ],

                return_url:
                    returnUrl,

                notify_url:
                    notifyUrl,

                language:
                    OCTO_LANGUAGE,

                ttl:
                    OCTO_TTL_MINUTES,

                init_time:
                    currentOctoTime(),

                auto_capture:
                    true,

                test:
                    OCTO_TEST
            };

            const result =
                await octoRequest(
                    payload
                );

            if (
                Number(result.error) !== 0
            ) {

                return res
                    .status(502)
                    .json({
                        error:
                            result.message ||
                            "OCTO payment initialization failed."
                    });
            }

            const paymentUrl =
                result.octo_pay_url ||
                result.payment_url ||
                result.data?.octo_pay_url ||
                result.data?.payment_url ||
                "";

            const paymentUuid =
                result.octo_payment_UUID ||
                result.octo_payment_uuid ||
                result.payment_uuid ||
                result.data?.octo_payment_UUID ||
                result.data?.octo_payment_uuid ||
                "";

            if (!paymentUrl) {

                return res
                    .status(502)
                    .json({
                        error:
                            "OCTO did not return a payment URL."
                    });
            }

            await dbRun(
                `
                UPDATE applications

                SET
                    payment_status = 'pending',
                    octo_transaction_id = ?,
                    octo_payment_uuid = ?,
                    octo_payment_url = ?,
                    octo_created_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    transactionId,
                    paymentUuid,
                    paymentUrl,
                    applicationId
                ]
            );

            res.json({

                ok: true,

                application_id:
                    applicationId,

                transaction_id:
                    transactionId,

                payment_uuid:
                    paymentUuid,

                payment_url:
                    paymentUrl,

                octo_pay_url:
                    paymentUrl,

                amount:
                    Number(
                        application.payment_amount
                    ),

                currency:
                    application.payment_currency
            });

        } catch (error) {

            console.error(
                "OCTO CREATE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "Payment creation failed."
            });
        }
    }
);

/* =========================================================
   VERIFY PAYMENT
========================================================= */

async function verifyAndUpdatePayment(
    application,
    octoResult
) {

    const status =
        extractOctoStatus(
            octoResult
        );

    const amount =
        extractOctoAmount(
            octoResult
        );

    const currency =
        extractOctoCurrency(
            octoResult
        );

    const amountMatches =
        amount !== null &&
        moneyEquals(
            amount,
            application.payment_amount
        );

    const currencyMatches =
        Boolean(currency) &&
        currency ===
            String(
                application.payment_currency
            ).toUpperCase();

    if (
        isOctoPaidStatus(status) &&
        amountMatches &&
        currencyMatches
    ) {

        await dbRun(
            `
            UPDATE applications

            SET
                payment_status = 'paid',
                status = 'paid',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = ?
            `,
            [application.id]
        );

        return "paid";
    }

    if (
        isOctoFailedStatus(status)
    ) {

        await dbRun(
            `
            UPDATE applications

            SET
                payment_status = 'failed',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = ?
            `,
            [application.id]
        );

        return "failed";
    }

    return "pending";
}

/* =========================================================
   OCTO NOTIFY
========================================================= */

async function octoNotifyHandler(
    req,
    res
) {

    try {

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        if (!octoConfigured()) {

            return res
                .status(503)
                .json({
                    error:
                        "OCTO is not configured."
                });
        }

        const body =
            req.body || {};

        const transactionId =
            String(
                body.shop_transaction_id ||
                body.transaction_id ||
                ""
            ).trim();

        const uuid =
            String(
                body.octo_payment_UUID ||
                body.octo_payment_uuid ||
                body.payment_uuid ||
                ""
            ).trim();

        const status =
            String(
                body.status || ""
            ).trim();

        const signature =
            String(
                body.signature ||
                body.hash_key ||
                ""
            ).trim();

        if (
            !transactionId ||
            !uuid ||
            !status ||
            !signature
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Incomplete OCTO callback."
                });
        }

        const expected =
            makeOctoSignature(
                uuid,
                status
            );

        if (
            !timingSafeEqualStrings(
                signature,
                expected
            )
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Invalid OCTO signature."
                });
        }

        const application =
            await dbGet(
                `
                SELECT *
                FROM applications

                WHERE
                    octo_transaction_id = ?

                LIMIT 1
                `,
                [transactionId]
            );

        if (!application) {

            return res
                .status(404)
                .json({
                    error:
                        "Application not found."
                });
        }

        if (
            application.octo_payment_uuid &&
            application.octo_payment_uuid !== uuid
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Payment UUID mismatch."
                });
        }

        const result =
            await getOctoPaymentStatus(
                transactionId
            );

        const finalStatus =
            await verifyAndUpdatePayment(
                application,
                result
            );

        res.json({

            ok: true,

            payment_status:
                finalStatus
        });

    } catch (error) {

        console.error(
            "OCTO NOTIFY ERROR:",
            error
        );

        res.status(500).json({
            error:
                "OCTO notification processing failed."
        });
    }
}

app.post(
    "/api/octo/notify",
    octoNotifyHandler
);

app.post(
    "/api/payments/octo/notify",
    octoNotifyHandler
);

/* =========================================================
   OCTO PAYMENT STATUS
========================================================= */

app.get(
    "/api/payments/octo/status/:applicationId",
    async (req, res) => {

        try {

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            const applicationId =
                Number(
                    req.params.applicationId
                );

            if (
                !Number.isInteger(
                    applicationId
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid application ID."
                    });
            }

            const application =
                await dbGet(
                    `
                    SELECT *
                    FROM applications

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [applicationId]
                );

            if (!application) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Application not found."
                    });
            }

            if (
                application.payment_status ===
                "paid"
            ) {

                return res.json({

                    ok: true,

                    application_id:
                        applicationId,

                    payment_status:
                        "paid"
                });
            }

            if (
                !application.octo_transaction_id
            ) {

                return res.json({

                    ok: true,

                    application_id:
                        applicationId,

                    payment_status:
                        "unpaid"
                });
            }

            const result =
                await getOctoPaymentStatus(
                    application.octo_transaction_id
                );

            const finalStatus =
                await verifyAndUpdatePayment(
                    application,
                    result
                );

            res.json({

                ok: true,

                application_id:
                    applicationId,

                payment_status:
                    finalStatus,

                octo_status:
                    extractOctoStatus(
                        result
                    )
            });

        } catch (error) {

            console.error(
                "OCTO STATUS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to check payment status."
            });
        }
    }
);

/* =========================================================
   ADMIN APPLICATIONS
========================================================= */

app.get(
    "/api/admin/applications",
    adminAuth,
    async (req, res) => {

        try {

            const rows =
                await dbAll(
                    `
                    SELECT *
                    FROM applications
                    ORDER BY id DESC
                    LIMIT 500
                    `
                );

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(rows);

        } catch (error) {

            console.error(
                "ADMIN APPLICATIONS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load applications."
            });
        }
    }
);

/* =========================================================
   ADMIN UPDATE APPLICATION
========================================================= */

app.patch(
    "/api/admin/applications/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({
                    error:
                        "Invalid application ID."
                });
            }

            const status =
                normalizeText(
                    req.body.status,
                    30
                ).toLowerCase();

            const allowedStatuses = [
                "new",
                "approved",
                "rejected"
            ];

            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid status."
                });
            }

            const application =
                await dbGet(
                    `
                    SELECT id
                    FROM applications
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [id]
                );

            if (!application) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }

            await dbRun(
                `
                UPDATE applications

                SET
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    status,
                    id
                ]
            );

            res.json({
                ok: true,
                id,
                status
            });

        } catch (error) {

            console.error(
                "ADMIN UPDATE APPLICATION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to update application."
            });
        }
    }
);

/* =========================================================
   ADMIN DELETE APPLICATION
========================================================= */

app.delete(
    "/api/admin/applications/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({
                    error:
                        "Invalid application ID."
                });
            }

            const result =
                await dbRun(
                    `
                    DELETE FROM applications
                    WHERE id = ?
                    `,
                    [id]
                );

            if (
                result.changes === 0
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }

            res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                "ADMIN DELETE APPLICATION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to delete application."
            });
        }
    }
);

/* =========================================================
   ADMIN BRANDS LIST
========================================================= */

app.get(
    "/api/admin/brands",
    adminAuth,
    async (req, res) => {

        try {

            const rows =
                await dbAll(
                    `
                    SELECT
                        b.id,
                        b.name,
                        b.logo,
                        b.category,
                        b.description,
                        b.website,
                        b.verification,
                        b.created_at,

                        c.name AS country_name,
                        c.code AS country_code

                    FROM brands b

                    LEFT JOIN countries c
                        ON c.id = b.country_id

                    ORDER BY
                        b.id DESC

                    LIMIT 1000
                    `
                );

            res.setHeader(
                "Cache-Control",
                "no-store"
            );

            res.json(rows);

        } catch (error) {

            console.error(
                "ADMIN BRANDS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load brands."
            });
        }
    }
);

/* =========================================================
   ADMIN CREATE BRAND
========================================================= */

app.post(
    "/api/admin/brands",
    adminAuth,
    async (req, res) => {

        try {

            const countryId =
                Number(
                    req.body.country_id
                );

            const name =
                normalizeText(
                    req.body.name,
                    150
                );

            const logo =
                normalizeText(
                    req.body.logo,
                    2048
                );

            const category =
                normalizeText(
                    req.body.category,
                    150
                );

            const description =
                normalizeText(
                    req.body.description,
                    3000
                );

            const website =
                normalizeText(
                    req.body.website,
                    2048
                );

            const verification =
                normalizeText(
                    req.body.verification ||
                    "Verified",
                    50
                );

            if (
                !Number.isInteger(
                    countryId
                ) ||
                !name
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Country and brand name are required."
                    });
            }

            if (
                isBlockedContent(
                    name,
                    description
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "This content is not allowed."
                    });
            }

            if (
                !isSafeUrl(logo) ||
                !isSafeUrl(website)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid URL."
                    });
            }

            const country =
                await dbGet(
                    `
                    SELECT id
                    FROM countries

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [countryId]
                );

            if (!country) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid country."
                    });
            }

            const result =
                await dbRun(
                    `
                    INSERT INTO brands
                    (
                        country_id,
                        name,
                        logo,
                        category,
                        description,
                        website,
                        verification
                    )

                    VALUES
                    (?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        countryId,
                        name,
                        logo,
                        category,
                        description,
                        website,
                        verification
                    ]
                );

            res.status(201).json({

                ok: true,

                id:
                    result.lastID
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Unable to create brand."
            });
        }
    }
);

/* =========================================================
   ADMIN DELETE BRAND
========================================================= */

app.delete(
    "/api/admin/brands/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(id)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid brand ID."
                    });
            }

            const result =
                await dbRun(
                    `
                    DELETE FROM brands
                    WHERE id = ?
                    `,
                    [id]
                );

            if (
                result.changes === 0
            ) {

                return res.status(404).json({
                    error:
                        "Brand not found."
                });
            }

            res.json({
                ok: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Unable to delete brand."
            });
        }
    }
);

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
    "/admin",
    adminAuth,
    (req, res) => {

        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
        );

        res.setHeader(
            "Pragma",
            "no-cache"
        );

        res.setHeader(
            "Expires",
            "0"
        );

        res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<meta
    http-equiv="Cache-Control"
    content="no-cache,no-store,must-revalidate"
>

<title>ALL WORLD BRANDS ADMIN</title>

<style>

*{
    box-sizing:border-box;
}

body{
    margin:0;
    font-family:Arial,sans-serif;
    color:#fff;

    background:
        linear-gradient(
            135deg,
            #020b24,
            #07183d,
            #2a0610
        );

    min-height:100vh;
}

.container{
    width:100%;
    max-width:1400px;
    margin:auto;
    padding:24px;
}

h1{
    margin:0;
    font-size:38px;
}

.subtitle{
    margin-top:8px;
    color:#b9c2d9;
    font-size:17px;
}

.stats{
    display:grid;
    grid-template-columns:
        repeat(4,minmax(0,1fr));
    gap:15px;
    margin:25px 0;
}

.stat{
    padding:20px;
    border-radius:15px;

    background:
        rgba(255,255,255,.07);

    border:
        1px solid
        rgba(255,255,255,.12);
}

.stat-title{
    color:#aeb8d0;
    font-size:14px;
}

.stat-value{
    margin-top:8px;
    font-size:30px;
    font-weight:bold;
}

.tabs{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-bottom:20px;
}

.tab{
    border:0;
    border-radius:10px;
    padding:12px 18px;
    cursor:pointer;

    background:#17284f;
    color:#fff;
    font-weight:bold;
}

.tab.active{
    background:#315bb5;
}

.panel{
    display:none;

    padding:20px;

    border-radius:16px;

    background:
        rgba(0,0,0,.28);

    border:
        1px solid
        rgba(255,255,255,.1);
}

.panel.active{
    display:block;
}

.toolbar{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-bottom:18px;
}

input,
select,
textarea{
    width:100%;

    padding:12px;

    border-radius:9px;

    border:
        1px solid
        rgba(255,255,255,.18);

    background:#07152f;
    color:#fff;
}

.search{
    max-width:400px;
}

button{
    border:0;
    border-radius:8px;

    padding:10px 14px;

    cursor:pointer;

    color:#fff;
    background:#315bb5;
}

button:hover{
    opacity:.85;
}

button.danger{
    background:#9b2435;
}

button.success{
    background:#207a4a;
}

button.gray{
    background:#46516a;
}

.table-wrap{
    width:100%;
    overflow-x:auto;
}

table{
    width:100%;
    min-width:900px;
    border-collapse:collapse;

    background:
        rgba(0,0,0,.22);
}

th,
td{
    padding:11px;

    border:
        1px solid
        rgba(255,255,255,.12);

    text-align:left;
}

th{
    background:
        rgba(255,255,255,.08);
}

.badge{
    display:inline-block;

    padding:5px 9px;

    border-radius:20px;

    font-size:12px;
    font-weight:bold;
}

.paid{
    background:#145d3a;
}

.unpaid{
    background:#704d13;
}

.pending{
    background:#314c7b;
}

.failed,
.rejected{
    background:#752238;
}

.new{
    background:#46516a;
}

.approved{
    background:#17603b;
}

.form-grid{
    display:grid;

    grid-template-columns:
        repeat(2,minmax(0,1fr));

    gap:15px;
}

.field{
    margin-bottom:5px;
}

.field label{
    display:block;
    margin-bottom:6px;
    color:#bfc8db;
    font-size:14px;
}

.full{
    grid-column:1/-1;
}

.empty{
    padding:30px;
    text-align:center;
    color:#aeb8d0;
}

.modal{
    position:fixed;

    inset:0;

    display:none;

    align-items:center;
    justify-content:center;

    padding:20px;

    background:
        rgba(0,0,0,.75);

    z-index:1000;
}

.modal.show{
    display:flex;
}

.modal-box{
    width:100%;
    max-width:650px;

    max-height:90vh;
    overflow:auto;

    padding:25px;

    border-radius:16px;

    background:#07152f;

    border:
        1px solid
        rgba(255,255,255,.15);
}

.modal-box h2{
    margin-top:0;
}

.detail{
    padding:10px 0;

    border-bottom:
        1px solid
        rgba(255,255,255,.1);
}

.detail strong{
    display:block;
    color:#aeb8d0;
    font-size:13px;
    margin-bottom:4px;
}

.close{
    float:right;
    background:#752238;
}

.message{
    margin:15px 0;
    padding:12px;
    border-radius:8px;
    display:none;
}

.message.show{
    display:block;
}

.message.error{
    background:#752238;
}

.message.success{
    background:#17603b;
}

@media(max-width:800px){

    .container{
        padding:14px;
    }

    h1{
        font-size:29px;
    }

    .stats{
        grid-template-columns:
            repeat(2,minmax(0,1fr));
    }

    .form-grid{
        grid-template-columns:1fr;
    }

    .full{
        grid-column:auto;
    }
}

@media(max-width:480px){

    .stats{
        grid-template-columns:1fr;
    }

    .stat-value{
        font-size:25px;
    }

    .toolbar button{
        width:auto;
    }
}

</style>

</head>

<body>

<div class="container">

<h1>
ALL WORLD BRANDS ADMIN
</h1>

<div class="subtitle">
Applications, payments and brands
</div>


<div class="stats">

<div class="stat">
<div class="stat-title">
Applications
</div>

<div
    class="stat-value"
    id="statApplications"
>
0
</div>
</div>


<div class="stat">
<div class="stat-title">
Paid
</div>

<div
    class="stat-value"
    id="statPaid"
>
0
</div>
</div>


<div class="stat">
<div class="stat-title">
Unpaid
</div>

<div
    class="stat-value"
    id="statUnpaid"
>
0
</div>
</div>


<div class="stat">
<div class="stat-title">
Brands
</div>

<div
    class="stat-value"
    id="statBrands"
>
0
</div>
</div>

</div>


<div class="tabs">

<button
    class="tab active"
    onclick="showTab('applications',this)"
>
Applications
</button>

<button
    class="tab"
    onclick="showTab('brands',this)"
>
Brands
</button>

<button
    class="tab"
    onclick="showTab('add-brand',this)"
>
Add Brand
</button>

</div>


<!-- =====================================================
     APPLICATIONS
===================================================== -->

<div
    id="applications"
    class="panel active"
>

<div class="toolbar">

<input
    id="applicationSearch"
    class="search"
    placeholder="Search brand, country, email..."
    oninput="renderApplications()"
>

<select
    id="paymentFilter"
    onchange="renderApplications()"
    style="max-width:180px"
>

<option value="">
All payments
</option>

<option value="paid">
Paid
</option>

<option value="unpaid">
Unpaid
</option>

<option value="pending">
Pending
</option>

<option value="failed">
Failed
</option>

</select>


<select
    id="statusFilter"
    onchange="renderApplications()"
    style="max-width:180px"
>

<option value="">
All statuses
</option>

<option value="new">
New
</option>

<option value="approved">
Approved
</option>

<option value="rejected">
Rejected
</option>

<option value="paid">
Paid
</option>

</select>


<button
    onclick="refreshAll()"
>
Refresh
</button>

</div>


<div
    id="applicationMessage"
    class="message"
></div>


<div class="table-wrap">

<table>

<thead>

<tr>

<th>ID</th>
<th>Brand</th>
<th>Country</th>
<th>Owner</th>
<th>Email</th>
<th>Payment</th>
<th>Status</th>
<th>Actions</th>

</tr>

</thead>

<tbody
    id="applicationsBody"
>

<tr>
<td
    colspan="8"
    class="empty"
>
Loading...
</td>
</tr>

</tbody>

</table>

</div>

</div>


<!-- =====================================================
     BRANDS
===================================================== -->

<div
    id="brands"
    class="panel"
>

<div class="toolbar">

<input
    id="brandSearch"
    class="search"
    placeholder="Search brands..."
    oninput="renderBrands()"
>

<button
    onclick="refreshAll()"
>
Refresh
</button>

</div>


<div class="table-wrap">

<table>

<thead>

<tr>

<th>ID</th>
<th>Brand</th>
<th>Country</th>
<th>Category</th>
<th>Verification</th>
<th>Website</th>
<th>Actions</th>

</tr>

</thead>

<tbody
    id="brandsBody"
>

<tr>

<td
    colspan="7"
    class="empty"
>
Loading...
</td>

</tr>

</tbody>

</table>

</div>

</div>


<!-- =====================================================
     ADD BRAND
===================================================== -->

<div
    id="add-brand"
    class="panel"
>

<h2>
Add Brand
</h2>


<div
    id="brandMessage"
    class="message"
></div>


<form
    id="brandForm"
>

<div class="form-grid">


<div class="field">

<label>
Brand name *
</label>

<input
    id="brandName"
    required
    maxlength="150"
>

</div>


<div class="field">

<label>
Country *
</label>

<select
    id="brandCountry"
    required
>

<option value="">
Select country
</option>

</select>

</div>


<div class="field">

<label>
Category
</label>

<input
    id="brandCategory"
    maxlength="150"
>

</div>


<div class="field">

<label>
Verification
</label>

<select
    id="brandVerification"
>

<option value="Verified">
Verified
</option>

<option value="Unverified">
Unverified
</option>

</select>

</div>


<div class="field">

<label>
Website
</label>

<input
    id="brandWebsite"
    type="url"
>

</div>


<div class="field">

<label>
Logo URL
</label>

<input
    id="brandLogo"
    type="url"
>

</div>


<div class="field full">

<label>
Description
</label>

<textarea
    id="brandDescription"
    rows="5"
    maxlength="3000"
></textarea>

</div>


</div>

<br>

<button
    type="submit"
>
Add Brand
</button>

</form>

</div>

</div>


<!-- =====================================================
     MODAL
===================================================== -->

<div
    id="modal"
    class="modal"
    onclick="closeModal(event)"
>

<div
    class="modal-box"
    onclick="event.stopPropagation()"
>

<button
    class="close"
    onclick="closeModal()"
>
Close
</button>

<div
    id="modalContent"
></div>

</div>

</div>


<script>

let applications = [];
let brands = [];
let countries = [];


/* =========================================================
   API
========================================================= */

async function api(
    url,
    options = {}
){

    const response =
        await fetch(
            url,
            {
                cache:"no-store",
                ...options
            }
        );

    let data = null;

    try{

        data =
            await response.json();

    }catch{

        data = null;

    }

    if(!response.ok){

        throw new Error(
            data?.error ||
            "Request failed."
        );

    }

    return data;
}


/* =========================================================
   TABS
========================================================= */

function showTab(
    id,
    button
){

    document
        .querySelectorAll(".panel")
        .forEach(
            x =>
                x.classList.remove(
                    "active"
                )
        );

    document
        .querySelectorAll(".tab")
        .forEach(
            x =>
                x.classList.remove(
                    "active"
                )
        );

    document
        .getElementById(id)
        .classList.add("active");

    button.classList.add("active");
}


/* =========================================================
   LOAD COUNTRIES
========================================================= */

async function loadCountries(){

    countries =
        await api(
            "/api/countries"
        );

    const select =
        document.getElementById(
            "brandCountry"
        );

    select.innerHTML =
        '<option value="">Select country</option>';

    countries.forEach(
        c => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                c.id;

            option.textContent =
                c.name;

            select.appendChild(
                option
            );

        }
    );
}


/* =========================================================
   LOAD APPLICATIONS
========================================================= */

async function loadApplications(){

    applications =
        await api(
            "/api/admin/applications"
        );

    updateStats();

    renderApplications();
}


/* =========================================================
   LOAD BRANDS
========================================================= */

async function loadBrands(){

    brands =
        await api(
            "/api/admin/brands"
        );

    updateStats();

    renderBrands();
}


/* =========================================================
   REFRESH ALL
========================================================= */

async function refreshAll(){

    try{

        await Promise.all([
            loadCountries(),
            loadApplications(),
            loadBrands()
        ]);

    }catch(error){

        console.error(
            "ADMIN REFRESH ERROR:",
            error
        );

        showMessage(
            "applicationMessage",
            error.message,
            "error"
        );

    }
}


/* =========================================================
   STATS
========================================================= */

function updateStats(){

    document.getElementById(
        "statApplications"
    ).textContent =
        applications.length;


    document.getElementById(
        "statPaid"
    ).textContent =
        applications.filter(
            x =>
                String(
                    x.payment_status || ""
                )
                .toLowerCase()
                === "paid"
        ).length;


    document.getElementById(
        "statUnpaid"
    ).textContent =
        applications.filter(
            x =>
                [
                    "unpaid",
                    "failed"
                ].includes(
                    String(
                        x.payment_status || ""
                    ).toLowerCase()
                )
        ).length;


    document.getElementById(
        "statBrands"
    ).textContent =
        brands.length;
}


/* =========================================================
   APPLICATIONS
========================================================= */

function renderApplications(){

    const body =
        document.getElementById(
            "applicationsBody"
        );

    const search =
        String(
            document.getElementById(
                "applicationSearch"
            ).value || ""
        ).toLowerCase();


    const payment =
        document.getElementById(
            "paymentFilter"
        ).value;


    const status =
        document.getElementById(
            "statusFilter"
        ).value;


    const filtered =
        applications.filter(
            x => {

                const text =
                    [
                        x.id,
                        x.brand_name,
                        x.country,
                        x.owner_name,
                        x.email,
                        x.phone
                    ]
                    .join(" ")
                    .toLowerCase();


                const paymentOk =
                    !payment ||
                    String(
                        x.payment_status || ""
                    )
                    .toLowerCase()
                    === payment;


                const statusOk =
                    !status ||
                    String(
                        x.status || ""
                    )
                    .toLowerCase()
                    === status;


                return (
                    text.includes(search) &&
                    paymentOk &&
                    statusOk
                );

            }
        );


    if(!filtered.length){

        body.innerHTML =
            `
            <tr>
                <td
                    colspan="8"
                    class="empty"
                >
                    No applications found.
                </td>
            </tr>
            `;

        return;
    }


    body.innerHTML =
        filtered
        .map(
            x => {

                const paymentStatus =
                    String(
                        x.payment_status ||
                        "unpaid"
                    ).toLowerCase();


                const status =
                    String(
                        x.status ||
                        "new"
                    ).toLowerCase();


                return `

<tr>

<td>
${escapeHtml(x.id)}
</td>

<td>
<strong>
${escapeHtml(x.brand_name)}
</strong>
</td>

<td>
${escapeHtml(x.country)}
</td>

<td>
${escapeHtml(x.owner_name)}
</td>

<td>
${escapeHtml(x.email)}
</td>

<td>

<span
    class="badge ${escapeHtml(paymentStatus)}"
>
${escapeHtml(paymentStatus)}
</span>

</td>

<td>

<span
    class="badge ${escapeHtml(status)}"
>
${escapeHtml(status)}
</span>

</td>

<td>

<button
    onclick="viewApplication(${Number(x.id)})"
>
View
</button>

<button
    class="success"
    onclick="changeStatus(${Number(x.id)},'approved')"
>
Approve
</button>

<button
    class="danger"
    onclick="changeStatus(${Number(x.id)},'rejected')"
>
Reject
</button>

<button
    class="danger"
    onclick="deleteApplication(${Number(x.id)})"
>
Delete
</button>

</td>

</tr>

`;

            }
        )
        .join("");
}


/* =========================================================
   VIEW APPLICATION
========================================================= */

function viewApplication(id){

    const x =
        applications.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if(!x){
        return;
    }


    document.getElementById(
        "modalContent"
    ).innerHTML = `

<h2>
Application #${escapeHtml(x.id)}
</h2>

<div class="detail">

<strong>
Brand
</strong>

${escapeHtml(x.brand_name)}

</div>


<div class="detail">

<strong>
Country
</strong>

${escapeHtml(x.country)}

</div>


<div class="detail">

<strong>
Owner
</strong>

${escapeHtml(x.owner_name)}

</div>


<div class="detail">

<strong>
Email
</strong>

${escapeHtml(x.email)}

</div>


<div class="detail">

<strong>
Phone
</strong>

${escapeHtml(x.phone)}

</div>


<div class="detail">

<strong>
Website
</strong>

${escapeHtml(x.website)}

</div>


<div class="detail">

<strong>
Payment
</strong>

${escapeHtml(x.payment_status)}

</div>


<div class="detail">

<strong>
Amount
</strong>

${escapeHtml(x.payment_amount)}
${escapeHtml(x.payment_currency)}

</div>


<div class="detail">

<strong>
OCTO Transaction
</strong>

${escapeHtml(x.octo_transaction_id)}

</div>


<div class="detail">

<strong>
Status
</strong>

${escapeHtml(x.status)}

</div>


<div class="detail">

<strong>
Created
</strong>

${escapeHtml(x.created_at)}

</div>


<div class="detail">

<strong>
Updated
</strong>

${escapeHtml(x.updated_at)}

</div>


<div class="detail">

<strong>
Description
</strong>

${escapeHtml(x.description)}

</div>

`;


    document
        .getElementById(
            "modal"
        )
        .classList.add(
            "show"
        );
}


/* =========================================================
   CHANGE STATUS
========================================================= */

async function changeStatus(
    id,
    status
){

    if(
        !confirm(
            "Change application status to " +
            status +
            "?"
        )
    ){

        return;

    }


    try{

        await api(
            "/api/admin/applications/" +
            encodeURIComponent(id),
            {

                method:
                    "PATCH",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        status
                    })

            }
        );


        await loadApplications();

    }catch(error){

        showMessage(
            "applicationMessage",
            error.message,
            "error"
        );

    }
}


/* =========================================================
   DELETE APPLICATION
========================================================= */

async function deleteApplication(id){

    if(
        !confirm(
            "Delete this application permanently?"
        )
    ){

        return;

    }


    try{

        await api(
            "/api/admin/applications/" +
            encodeURIComponent(id),
            {
                method:
                    "DELETE"
            }
        );


        await loadApplications();

    }catch(error){

        showMessage(
            "applicationMessage",
            error.message,
            "error"
        );

    }
}


/* =========================================================
   BRANDS
========================================================= */

function renderBrands(){

    const body =
        document.getElementById(
            "brandsBody"
        );


    const search =
        String(
            document.getElementById(
                "brandSearch"
            ).value || ""
        ).toLowerCase();


    const filtered =
        brands.filter(
            x => {

                const text =
                    [
                        x.id,
                        x.name,
                        x.country_name,
                        x.category,
                        x.verification
                    ]
                    .join(" ")
                    .toLowerCase();


                return text.includes(
                    search
                );

            }
        );


    if(!filtered.length){

        body.innerHTML =
            `
            <tr>
                <td
                    colspan="7"
                    class="empty"
                >
                    No brands found.
                </td>
            </tr>
            `;

        return;
    }


    body.innerHTML =
        filtered
        .map(
            x => `

<tr>

<td>
${escapeHtml(x.id)}
</td>

<td>

<strong>
${escapeHtml(x.name)}
</strong>

</td>

<td>
${escapeHtml(x.country_name)}
</td>

<td>
${escapeHtml(x.category)}
</td>

<td>
${escapeHtml(x.verification)}
</td>

<td>
${escapeHtml(x.website)}
</td>

<td>

<button
    onclick="viewBrand(${Number(x.id)})"
>
View
</button>

<button
    class="danger"
    onclick="deleteBrand(${Number(x.id)})"
>
Delete
</button>

</td>

</tr>

`
        )
        .join("");
}


/* =========================================================
   VIEW BRAND
========================================================= */

function viewBrand(id){

    const x =
        brands.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if(!x){
        return;
    }


    document.getElementById(
        "modalContent"
    ).innerHTML = `

<h2>
${escapeHtml(x.name)}
</h2>


<div class="detail">

<strong>
Country
</strong>

${escapeHtml(x.country_name)}

</div>


<div class="detail">

<strong>
Category
</strong>

${escapeHtml(x.category)}

</div>


<div class="detail">

<strong>
Verification
</strong>

${escapeHtml(x.verification)}

</div>


<div class="detail">

<strong>
Website
</strong>

${escapeHtml(x.website)}

</div>


<div class="detail">

<strong>
Logo
</strong>

${escapeHtml(x.logo)}

</div>


<div class="detail">

<strong>
Description
</strong>

${escapeHtml(x.description)}

</div>

`;


    document
        .getElementById(
            "modal"
        )
        .classList.add(
            "show"
        );
}


/* =========================================================
   DELETE BRAND
========================================================= */

async function deleteBrand(id){

    if(
        !confirm(
            "Delete this brand permanently?"
        )
    ){

        return;

    }


    try{

        await api(
            "/api/admin/brands/" +
            encodeURIComponent(id),
            {
                method:
                    "DELETE"
            }
        );


        await loadBrands();

    }catch(error){

        showMessage(
            "applicationMessage",
            error.message,
            "error"
        );

    }
}


/* =========================================================
   ADD BRAND
========================================================= */

document
    .getElementById(
        "brandForm"
    )
    .addEventListener(
        "submit",
        async function(event){

            event.preventDefault();


            try{

                const data = {

                    name:
                        document
                        .getElementById(
                            "brandName"
                        )
                        .value
                        .trim(),


                    country_id:
                        Number(
                            document
                            .getElementById(
                                "brandCountry"
                            )
                            .value
                        ),


                    category:
                        document
                        .getElementById(
                            "brandCategory"
                        )
                        .value
                        .trim(),


                    verification:
                        document
                        .getElementById(
                            "brandVerification"
                        )
                        .value,


                    website:
                        document
                        .getElementById(
                            "brandWebsite"
                        )
                        .value
                        .trim(),


                    logo:
                        document
                        .getElementById(
                            "brandLogo"
                        )
                        .value
                        .trim(),


                    description:
                        document
                        .getElementById(
                            "brandDescription"
                        )
                        .value
                        .trim()

                };


                await api(
                    "/api/admin/brands",
                    {

                        method:
                            "POST",

                        headers:{
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                data
                            )

                    }
                );


                document
                    .getElementById(
                        "brandForm"
                    )
                    .reset();


                showMessage(
                    "brandMessage",
                    "Brand added successfully.",
                    "success"
                );


                await loadBrands();


            }catch(error){

                showMessage(
                    "brandMessage",
                    error.message,
                    "error"
                );

            }

        }
    );


/* =========================================================
   MODAL
========================================================= */

function closeModal(){

    document
        .getElementById(
            "modal"
        )
        .classList.remove(
            "show"
        );
}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    id,
    text,
    type
){

    const element =
        document.getElementById(
            id
        );


    if(!element){
        return;
    }


    element.textContent =
        text;


    element.className =
        "message show " +
        type;


    setTimeout(
        () => {

            element.className =
                "message";

        },
        5000
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value){

    return String(
        value ?? ""
    )

    .replace(
        /&/g,
        "&amp;"
    )

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    )

    .replace(
        /"/g,
        "&quot;"
    )

    .replace(
        /'/g,
        "&#039;"
    );
}


/* =========================================================
   START ADMIN
========================================================= */

refreshAll();

</script>

</body>

</html>
        `);
    }
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        ),
        {
            extensions: ["html"]
        }
    )
);

/* =========================================================
   SPA FALLBACK
========================================================= */

app.use(
    (req, res, next) => {

        if (
            req.method !== "GET" ||
            req.path.startsWith("/api/")
        ) {
            return next();
        }

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
   404
========================================================= */

app.use(
    (req, res) => {

        if (
            req.path.startsWith("/api/")
        ) {

            return res
                .status(404)
                .json({
                    error:
                        "API endpoint not found."
                });
        }

        res.status(404)
            .send("Not found.");
    }
);

/* =========================================================
   START SERVER
========================================================= */

initializeDatabase()

    .then(() => {

        app.listen(
            PORT,
            () => {

                console.log(
                    `ALL WORLD BRANDS running on port ${PORT}`
                );

                console.log(
                    `Countries/territories: ${COUNTRIES.length}`
                );

                console.log(
                    `OCTO configured: ${octoConfigured()}`
                );

                console.log(
                    `Payment: ${BRAND_APPLICATION_AMOUNT} ${BRAND_APPLICATION_CURRENCY}`
                );
            }
        );

    })

    .catch(error => {

        console.error(
            "Database initialization failed:",
            error
        );

        process.exit(1);
    });

/* =========================================================
   SHUTDOWN
========================================================= */

process.on(
    "SIGINT",
    () => {

        appDb.close(() => {
            process.exit(0);
        });

    }
);

process.on(
    "SIGTERM",
    () => {

        appDb.close(() => {
            process.exit(0);
        });

    }
);
