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

/* =========================================================
   DATABASE
========================================================= */

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "allworldbrands.db");

/* =========================================================
   OCTO
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
    Number(
        process.env.BRAND_APPLICATION_AMOUNT || 1
    );

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
   DATABASE CONNECTION
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

/* =========================================================
   DATABASE HELPERS
========================================================= */

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        appDb.run(
            sql,
            params,
            function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        );
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        appDb.get(
            sql,
            params,
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(row);
            }
        );
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        appDb.all(
            sql,
            params,
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(rows || []);
            }
        );
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

function normalizeText(
    value,
    max = 1000
) {
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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}

function isSafeUrl(value) {
    const url =
        String(value || "").trim();

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
        const parsed =
            new URL(url);

        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        );
    } catch {
        return false;
    }
}

/* =========================================================
   MODERATION
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

    return ADULT_CONTENT_WORDS.some(
        word =>
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
    const aa =
        Buffer.from(String(a || ""));

    const bb =
        Buffer.from(String(b || ""));

    if (aa.length !== bb.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        aa,
        bb
    );
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
    return (
        "https://secure.octo.uz/prepare_payment"
    );
}

function octoStatusUrl() {
    return (
        "https://secure.octo.uz/prepare_payment"
    );
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
            message:
                "Empty OCTO response"
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
    const response =
        await fetch(
            octoInitUrl(),
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(payload)
            }
        );

    const text =
        await response.text();

    let json;

    try {
        json =
            JSON.parse(text);
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

    const response =
        await fetch(
            octoStatusUrl(),
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(payload)
            }
        );

    const text =
        await response.text();

    let json;

    try {
        json =
            JSON.parse(text);
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

    for (
        const value of candidates
    ) {
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

    for (
        const value of candidates
    ) {
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

    for (
        const value of candidates
    ) {
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
        String(status || "")
            .toLowerCase()
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
        String(status || "")
            .toLowerCase()
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
   COUNTRIES
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

    for (
        const [name, code]
        of COUNTRIES
    ) {

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

    for (
        const brand
        of starterBrands
    ) {

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
            .send(
                "Admin credentials are not configured."
            );
    }

    const header =
        req.headers.authorization || "";

    if (
        !header.startsWith("Basic ")
    ) {

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
   CREATE APPLICATION
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

            console.error(
                "APPLICATION ERROR:",
                error
            );

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
   PAYMENT STATUS
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

            console.error(error);

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
                    [id]
                );

            if (!application) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Application not found."
                    });
            }

            const allowedStatuses = [
                "new",
                "approved",
                "rejected",
                "paid"
            ];

            const requestedStatus =
                normalizeText(
                    req.body.status,
                    30
                ).toLowerCase();

            if (
                !allowedStatuses.includes(
                    requestedStatus
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid status."
                    });
            }

            /*
             * Payment status is NOT controlled
             * by this admin endpoint.
             *
             * OCTO verification remains the
             * only authority for payment_status.
             */

            await dbRun(
                `
                UPDATE applications

                SET
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    requestedStatus,
                    id
                ]
            );

            const updated =
                await dbGet(
                    `
                    SELECT *
                    FROM applications
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [id]
                );

            res.json({
                ok: true,
                application: updated
            });

        } catch (error) {

            console.error(
                "ADMIN APPLICATION UPDATE ERROR:",
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

                return res
                    .status(404)
                    .json({
                        error:
                            "Application not found."
                    });
            }

            res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                "ADMIN APPLICATION DELETE ERROR:",
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
   ADMIN BRANDS
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

                        c.id
                            AS country_id,

                        c.name
                            AS country_name,

                        c.code
                            AS country_code

                    FROM brands b

                    JOIN countries c
                        ON c.id =
                           b.country_id

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

            const duplicate =
                await dbGet(
                    `
                    SELECT id
                    FROM brands

                    WHERE
                        name = ?
                        AND country_id = ?

                    LIMIT 1
                    `,
                    [
                        name,
                        countryId
                    ]
                );

            if (duplicate) {

                return res
                    .status(409)
                    .json({
                        error:
                            "This brand already exists in this country."
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

            const created =
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

                    WHERE b.id = ?

                    LIMIT 1
                    `,
                    [result.lastID]
                );

            res.status(201).json({

                ok: true,

                id:
                    result.lastID,

                brand:
                    created
            });

        } catch (error) {

            console.error(
                "ADMIN CREATE BRAND ERROR:",
                error
            );

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

                return res
                    .status(404)
                    .json({
                        error:
                            "Brand not found."
                    });
            }

            res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                "ADMIN DELETE BRAND ERROR:",
                error
            );

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

        res.send(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>ALL WORLD BRANDS ADMIN</title>

<style>

*{
    box-sizing:border-box;
}

html,
body{
    margin:0;
    padding:0;
    min-height:100%;
}

body{
    font-family:
        Arial,
        Helvetica,
        sans-serif;

    color:#fff;

    background:
        linear-gradient(
            135deg,
            #020b24 0%,
            #07183d 48%,
            #260611 100%
        );

    padding:18px;
}

.container{
    width:100%;
    max-width:1400px;
    margin:0 auto;
}

h1{
    font-size:34px;
    margin:10px 0 6px;
}

.subtitle{
    color:#bfc8dc;
    margin-bottom:20px;
}

.stats{
    display:grid;
    grid-template-columns:
        repeat(4,minmax(0,1fr));

    gap:12px;

    margin-bottom:20px;
}

.stat{
    background:
        rgba(255,255,255,.07);

    border:
        1px solid
        rgba(255,255,255,.12);

    border-radius:14px;

    padding:18px;
}

.stat-number{
    font-size:28px;
    font-weight:700;
}

.stat-label{
    color:#b8c2d8;
    margin-top:5px;
}

.tabs{
    display:flex;
    gap:8px;
    margin-bottom:16px;
    flex-wrap:wrap;
}

.tab{
    border:1px solid
        rgba(255,255,255,.15);

    background:
        rgba(255,255,255,.06);

    color:#fff;

    padding:10px 16px;

    border-radius:10px;

    cursor:pointer;
}

.tab.active{
    background:#fff;
    color:#07183d;
}

.panel{
    display:none;

    background:
        rgba(0,0,0,.28);

    border:
        1px solid
        rgba(255,255,255,.12);

    border-radius:14px;

    padding:16px;

    margin-bottom:20px;
}

.panel.active{
    display:block;
}

.toolbar{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-bottom:15px;
}

input,
select,
textarea{
    width:100%;

    padding:11px 12px;

    border-radius:9px;

    border:
        1px solid
        rgba(255,255,255,.18);

    background:
        rgba(0,0,0,.35);

    color:#fff;

    outline:none;
}

.toolbar input{
    max-width:420px;
}

button{
    border:0;
    border-radius:9px;
    padding:10px 14px;
    cursor:pointer;
    font-weight:600;
}

.btn{
    background:#fff;
    color:#07183d;
}

.btn-danger{
    background:#a91d32;
    color:#fff;
}

.btn-green{
    background:#16794b;
    color:#fff;
}

.btn-blue{
    background:#245ec7;
    color:#fff;
}

.table-wrap{
    width:100%;
    overflow-x:auto;
}

table{
    width:100%;
    min-width:800px;
    border-collapse:collapse;
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
    border-radius:999px;
    font-size:12px;
}

.paid{
    background:#145c3c;
}

.pending{
    background:#76591a;
}

.unpaid{
    background:#59303a;
}

.failed{
    background:#8b1d2b;
}

.new{
    background:#245ec7;
}

.approved{
    background:#16794b;
}

.rejected{
    background:#8b1d2b;
}

.form-grid{
    display:grid;

    grid-template-columns:
        repeat(2,minmax(0,1fr));

    gap:12px;
}

.form-full{
    grid-column:
        1 / -1;
}

.actions{
    display:flex;
    gap:6px;
    flex-wrap:wrap;
}

.empty{
    padding:30px;
    text-align:center;
    color:#aeb8cd;
}

.message{
    padding:10px 12px;
    border-radius:8px;
    margin-bottom:12px;
    display:none;
}

.message.show{
    display:block;
}

.message.error{
    background:#6f1d2a;
}

.message.success{
    background:#145c3c;
}

.modal{
    display:none;

    position:fixed;

    inset:0;

    background:
        rgba(0,0,0,.75);

    align-items:center;
    justify-content:center;

    padding:15px;

    z-index:999;
}

.modal.show{
    display:flex;
}

.modal-box{
    width:100%;
    max-width:700px;

    max-height:90vh;

    overflow:auto;

    background:
        #07152f;

    border:
        1px solid
        rgba(255,255,255,.16);

    border-radius:15px;

    padding:20px;
}

.modal-head{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
    margin-bottom:15px;
}

.close{
    background:
        rgba(255,255,255,.1);

    color:#fff;
}

.detail{
    display:grid;
    gap:10px;
}

.detail-row{
    padding:10px;
    background:
        rgba(255,255,255,.05);

    border-radius:8px;
}

.detail-label{
    color:#9eabc5;
    font-size:12px;
    margin-bottom:4px;
}

@media(max-width:800px){

    body{
        padding:10px;
    }

    h1{
        font-size:27px;
    }

    .stats{
        grid-template-columns:
            repeat(2,minmax(0,1fr));
    }

    .form-grid{
        grid-template-columns:1fr;
    }

    .form-full{
        grid-column:auto;
    }
}

@media(max-width:480px){

    .stats{
        grid-template-columns:1fr;
    }

    .stat-number{
        font-size:24px;
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

<div id="message"
     class="message">
</div>

<div class="stats">

<div class="stat">
<div
    id="statApplications"
    class="stat-number">
0
</div>
<div class="stat-label">
Applications
</div>
</div>

<div class="stat">
<div
    id="statPaid"
    class="stat-number">
0
</div>
<div class="stat-label">
Paid
</div>
</div>

<div class="stat">
<div
    id="statUnpaid"
    class="stat-number">
0
</div>
<div class="stat-label">
Unpaid / Pending
</div>
</div>

<div class="stat">
<div
    id="statBrands"
    class="stat-number">
0
</div>
<div class="stat-label">
Brands
</div>
</div>

</div>

<div class="tabs">

<button
    class="tab active"
    onclick="showTab('applications',this)">
Applications
</button>

<button
    class="tab"
    onclick="showTab('brands',this)">
Brands
</button>

<button
    class="tab"
    onclick="showTab('addbrand',this)">
Add Brand
</button>

</div>

<!-- APPLICATIONS -->

<section
    id="applications"
    class="panel active">

<div class="toolbar">

<input
    id="applicationSearch"
    placeholder="Search applications..."
    oninput="renderApplications()"
>

<select
    id="paymentFilter"
    onchange="renderApplications()">

<option value="">
All payments
</option>

<option value="paid">
Paid
</option>

<option value="pending">
Pending
</option>

<option value="unpaid">
Unpaid
</option>

<option value="failed">
Failed
</option>

</select>

<select
    id="statusFilter"
    onchange="renderApplications()">

<option value="">
All statuses
</option>

<option value="new">
New
</option>

<option value="paid">
Paid
</option>

<option value="approved">
Approved
</option>

<option value="rejected">
Rejected
</option>

</select>

<button
    class="btn"
    onclick="refreshAll()">
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
<th>Email</th>
<th>Payment</th>
<th>Status</th>
<th>Actions</th>

</tr>

</thead>

<tbody id="applicationsBody">

<tr>
<td colspan="7"
    class="empty">
Loading...
</td>
</tr>

</tbody>

</table>

</div>

</section>

<!-- BRANDS -->

<section
    id="brands"
    class="panel">

<div class="toolbar">

<input
    id="brandSearch"
    placeholder="Search brands..."
    oninput="renderBrands()"
>

<button
    class="btn"
    onclick="refreshAll()">
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
<th>Actions</th>

</tr>

</thead>

<tbody id="brandsBody">

<tr>
<td colspan="6"
    class="empty">
Loading...
</td>
</tr>

</tbody>

</table>

</div>

</section>

<!-- ADD BRAND -->

<section
    id="addbrand"
    class="panel">

<h2>
Add Brand
</h2>

<form
    id="brandForm"
    onsubmit="addBrand(event)">

<div class="form-grid">

<div>

<label>
Brand name
</label>

<input
    id="brandName"
    required
    maxlength="150"
>

</div>

<div>

<label>
Country
</label>

<select
    id="brandCountry"
    required>

<option value="">
Select country
</option>

</select>

</div>

<div>

<label>
Category
</label>

<input
    id="brandCategory"
    maxlength="150"
>

</div>

<div>

<label>
Verification
</label>

<select
    id="brandVerification">

<option value="Verified">
Verified
</option>

<option value="Unverified">
Unverified
</option>

</select>

</div>

<div>

<label>
Website
</label>

<input
    id="brandWebsite"
    type="url"
    placeholder="https://..."
>

</div>

<div>

<label>
Logo URL
</label>

<input
    id="brandLogo"
    type="url"
    placeholder="https://..."
>

</div>

<div class="form-full">

<label>
Description
</label>

<textarea
    id="brandDescription"
    rows="5"
    maxlength="3000">
</textarea>

</div>

<div class="form-full">

<button
    class="btn-green"
    type="submit">

Create Brand

</button>

</div>

</div>

</form>

</section>

</div>

<!-- MODAL -->

<div
    id="modal"
    class="modal">

<div class="modal-box">

<div class="modal-head">

<h2 id="modalTitle">
Details
</h2>

<button
    class="close"
    onclick="closeModal()">
Close
</button>

</div>

<div
    id="modalContent"
    class="detail">
</div>

</div>

</div>

<script>

let applications = [];
let brands = [];
let countries = [];

/* =====================================================
   API
===================================================== */

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                cache:"no-store",
                ...options
            }
        );

    let data = null;

    try {
        data =
            await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {

        throw new Error(
            data?.error ||
            "Request failed."
        );
    }

    return data;
}

/* =====================================================
   MESSAGE
===================================================== */

function showMessage(
    text,
    type = "success"
) {

    const el =
        document.getElementById(
            "message"
        );

    el.textContent = text;

    el.className =
        "message show " + type;

    setTimeout(
        () => {
            el.className =
                "message";
        },
        3500
    );
}

/* =====================================================
   ESCAPE
===================================================== */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/* =====================================================
   TABS
===================================================== */

function showTab(
    id,
    button
) {

    document
        .querySelectorAll(".panel")
        .forEach(
            el =>
                el.classList.remove(
                    "active"
                )
        );

    document
        .querySelectorAll(".tab")
        .forEach(
            el =>
                el.classList.remove(
                    "active"
                )
        );

    document
        .getElementById(id)
        .classList.add("active");

    button.classList.add("active");
}

/* =====================================================
   COUNTRIES
===================================================== */

async function loadCountries() {

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
        country => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                country.id;

            option.textContent =
                country.name;

            select.appendChild(
                option
            );
        }
    );
}

/* =====================================================
   APPLICATIONS
===================================================== */

async function loadApplications() {

    applications =
        await api(
            "/api/admin/applications"
        );

    renderApplications();
    updateStats();
}

function renderApplications() {

    const body =
        document.getElementById(
            "applicationsBody"
        );

    const search =
        document.getElementById(
            "applicationSearch"
        ).value
         .trim()
         .toLowerCase();

    const payment =
        document.getElementById(
            "paymentFilter"
        ).value;

    const status =
        document.getElementById(
            "statusFilter"
        ).value;

    const rows =
        applications.filter(
            item => {

                const text =
                    [
                        item.id,
                        item.brand_name,
                        item.country,
                        item.owner_name,
                        item.email,
                        item.phone
                    ]
                    .join(" ")
                    .toLowerCase();

                if (
                    search &&
                    !text.includes(search)
                ) {
                    return false;
                }

                if (
                    payment &&
                    String(
                        item.payment_status ||
                        ""
                    ).toLowerCase()
                    !== payment
                ) {
                    return false;
                }

                if (
                    status &&
                    String(
                        item.status ||
                        ""
                    ).toLowerCase()
                    !== status
                ) {
                    return false;
                }

                return true;
            }
        );

    if (!rows.length) {

        body.innerHTML =
            '<tr><td colspan="7" class="empty">No applications found.</td></tr>';

        return;
    }

    body.innerHTML =
        rows.map(
            item => {

                const paymentStatus =
                    String(
                        item.payment_status ||
                        "unpaid"
                    ).toLowerCase();

                const appStatus =
                    String(
                        item.status ||
                        "new"
                    ).toLowerCase();

                return `

<tr>

<td>
${escapeHtml(item.id)}
</td>

<td>
<strong>
${escapeHtml(item.brand_name)}
</strong>
</td>

<td>
${escapeHtml(item.country)}
</td>

<td>
${escapeHtml(item.email)}
</td>

<td>

<span class="badge ${escapeHtml(paymentStatus)}">
${escapeHtml(paymentStatus)}
</span>

</td>

<td>

<span class="badge ${escapeHtml(appStatus)}">
${escapeHtml(appStatus)}
</span>

</td>

<td>

<div class="actions">

<button
    class="btn"
    onclick="viewApplication(${Number(item.id)})">
View
</button>

<button
    class="btn-blue"
    onclick="changeStatus(${Number(item.id)},'approved')">
Approve
</button>

<button
    class="btn-danger"
    onclick="changeStatus(${Number(item.id)},'rejected')">
Reject
</button>

<button
    class="btn-danger"
    onclick="deleteApplication(${Number(item.id)})">
Delete
</button>

</div>

</td>

</tr>

`;

            }
        )
        .join("");
}

/* =====================================================
   VIEW APPLICATION
===================================================== */

function viewApplication(id) {

    const item =
        applications.find(
            x =>
                Number(x.id) ===
                Number(id)
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "modalTitle"
    ).textContent =
        "Application #" + item.id;

    document.getElementById(
        "modalContent"
    ).innerHTML = `

<div class="detail-row">
<div class="detail-label">Brand</div>
${escapeHtml(item.brand_name)}
</div>

<div class="detail-row">
<div class="detail-label">Country</div>
${escapeHtml(item.country)}
</div>

<div class="detail-row">
<div class="detail-label">Owner</div>
${escapeHtml(item.owner_name)}
</div>

<div class="detail-row">
<div class="detail-label">Email</div>
${escapeHtml(item.email)}
</div>

<div class="detail-row">
<div class="detail-label">Phone</div>
${escapeHtml(item.phone)}
</div>

<div class="detail-row">
<div class="detail-label">Website</div>
${escapeHtml(item.website)}
</div>

<div class="detail-row">
<div class="detail-label">Payment</div>
${escapeHtml(item.payment_status)}
</div>

<div class="detail-row">
<div class="detail-label">Amount</div>
${escapeHtml(item.payment_amount)}
${escapeHtml(item.payment_currency)}
</div>

<div class="detail-row">
<div class="detail-label">Status</div>
${escapeHtml(item.status)}
</div>

<div class="detail-row">
<div class="detail-label">Description</div>
${escapeHtml(item.description)}
</div>

<div class="detail-row">
<div class="detail-label">Created</div>
${escapeHtml(item.created_at)}
</div>

`;

    document
        .getElementById("modal")
        .classList.add("show");
}

function closeModal() {

    document
        .getElementById("modal")
        .classList.remove("show");
}

/* =====================================================
   CHANGE STATUS
===================================================== */

async function changeStatus(
    id,
    status
) {

    if (
        !confirm(
            "Change application status to " +
            status +
            "?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/admin/applications/" +
            encodeURIComponent(id),

            {
                method:"PATCH",

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

        showMessage(
            "Application status updated."
        );

        await loadApplications();

    } catch(error) {

        showMessage(
            error.message,
            "error"
        );
    }
}

/* =====================================================
   DELETE APPLICATION
===================================================== */

async function deleteApplication(
    id
) {

    if (
        !confirm(
            "Delete this application?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/admin/applications/" +
            encodeURIComponent(id),

            {
                method:"DELETE"
            }
        );

        showMessage(
            "Application deleted."
        );

        await loadApplications();

    } catch(error) {

        showMessage(
            error.message,
            "error"
        );
    }
}

/* =====================================================
   BRANDS
===================================================== */

async function loadBrands() {

    brands =
        await api(
            "/api/admin/brands"
        );

    renderBrands();
    updateStats();
}

function renderBrands() {

    const body =
        document.getElementById(
            "brandsBody"
        );

    const search =
        document.getElementById(
            "brandSearch"
        ).value
         .trim()
         .toLowerCase();

    const rows =
        brands.filter(
            item => {

                const text =
                    [
                        item.id,
                        item.name,
                        item.country_name,
                        item.category
                    ]
                    .join(" ")
                    .toLowerCase();

                return (
                    !search ||
                    text.includes(search)
                );
            }
        );

    if (!rows.length) {

        body.innerHTML =
            '<tr><td colspan="6" class="empty">No brands found.</td></tr>';

        return;
    }

    body.innerHTML =
        rows.map(
            item => `

<tr>

<td>
${escapeHtml(item.id)}
</td>

<td>
<strong>
${escapeHtml(item.name)}
</strong>
</td>

<td>
${escapeHtml(item.country_name)}
</td>

<td>
${escapeHtml(item.category)}
</td>

<td>
${escapeHtml(item.verification)}
</td>

<td>

<div class="actions">

<button
    class="btn"
    onclick="viewBrand(${Number(item.id)})">
View
</button>

<button
    class="btn-danger"
    onclick="deleteBrand(${Number(item.id)})">
Delete
</button>

</div>

</td>

</tr>

`
        )
        .join("");
}

/* =====================================================
   VIEW BRAND
===================================================== */

function viewBrand(id) {

    const item =
        brands.find(
            x =>
                Number(x.id) ===
                Number(id)
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "modalTitle"
    ).textContent =
        "Brand #" + item.id;

    document.getElementById(
        "modalContent"
    ).innerHTML = `

<div class="detail-row">
<div class="detail-label">Brand</div>
${escapeHtml(item.name)}
</div>

<div class="detail-row">
<div class="detail-label">Country</div>
${escapeHtml(item.country_name)}
</div>

<div class="detail-row">
<div class="detail-label">Category</div>
${escapeHtml(item.category)}
</div>

<div class="detail-row">
<div class="detail-label">Verification</div>
${escapeHtml(item.verification)}
</div>

<div class="detail-row">
<div class="detail-label">Website</div>
${escapeHtml(item.website)}
</div>

<div class="detail-row">
<div class="detail-label">Logo</div>
${escapeHtml(item.logo)}
</div>

<div class="detail-row">
<div class="detail-label">Description</div>
${escapeHtml(item.description)}
</div>

`;

    document
        .getElementById("modal")
        .classList.add("show");
}

/* =====================================================
   DELETE BRAND
===================================================== */

async function deleteBrand(
    id
) {

    if (
        !confirm(
            "Delete this brand?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/admin/brands/" +
            encodeURIComponent(id),

            {
                method:"DELETE"
            }
        );

        showMessage(
            "Brand deleted."
        );

        await loadBrands();

    } catch(error) {

        showMessage(
            error.message,
            "error"
        );
    }
}

/* =====================================================
   ADD BRAND
===================================================== */

async function addBrand(
    event
) {

    event.preventDefault();

    const data = {

        name:
            document.getElementById(
                "brandName"
            ).value.trim(),

        country_id:
            Number(
                document.getElementById(
                    "brandCountry"
                ).value
            ),

        category:
            document.getElementById(
                "brandCategory"
            ).value.trim(),

        verification:
            document.getElementById(
                "brandVerification"
            ).value,

        website:
            document.getElementById(
                "brandWebsite"
            ).value.trim(),

        logo:
            document.getElementById(
                "brandLogo"
            ).value.trim(),

        description:
            document.getElementById(
                "brandDescription"
            ).value.trim()
    };

    try {

        await api(
            "/api/admin/brands",

            {
                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(data)
            }
        );

        document
            .getElementById(
                "brandForm"
            )
            .reset();

        showMessage(
            "Brand created successfully."
        );

        await loadBrands();

    } catch(error) {

        showMessage(
            error.message,
            "error"
        );
    }
}

/* =====================================================
   STATS
===================================================== */

function updateStats() {

    const total =
        applications.length;

    const paid =
        applications.filter(
            x =>
                String(
                    x.payment_status ||
                    ""
                ).toLowerCase() ===
                "paid"
        ).length;

    const unpaid =
        applications.filter(
            x =>
                String(
                    x.payment_status ||
                    ""
                ).toLowerCase() !==
                "paid"
        ).length;

    document.getElementById(
        "statApplications"
    ).textContent =
        total;

    document.getElementById(
        "statPaid"
    ).textContent =
        paid;

    document.getElementById(
        "statUnpaid"
    ).textContent =
        unpaid;

    document.getElementById(
        "statBrands"
    ).textContent =
        brands.length;
}

/* =====================================================
   REFRESH
===================================================== */

async function refreshAll() {

    try {

        await Promise.all([
            loadCountries(),
            loadApplications(),
            loadBrands()
        ]);

    } catch(error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );
    }
}

/* =====================================================
   START
===================================================== */

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
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "EXPRESS ERROR:",
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

initializeDatabase()

    .then(() => {

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    "===================================="
                );

                console.log(
                    "ALL WORLD BRANDS"
                );

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    `Database: ${DB_FILE}`
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

                console.log(
                    "===================================="
                );
            }
        );

    })

    .catch(error => {

        console.error(
            "DATABASE INITIALIZATION FAILED:"
        );

        console.error(error);

        process.exit(1);
    });

/* =========================================================
   SHUTDOWN
========================================================= */

function shutdown() {

    console.log(
        "Shutting down server..."
    );

    appDb.close(
        error => {

            if (error) {
                console.error(
                    "Database close error:",
                    error
                );
            }

            process.exit(
                error ? 1 : 0
            );
        }
    );
}

process.on(
    "SIGINT",
    shutdown
);

process.on(
    "SIGTERM",
    shutdown
);
