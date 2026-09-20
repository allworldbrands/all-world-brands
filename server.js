const express = require("express");
const path = require("path");
const fs = require("fs");
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

const OCTO_SHOP_ID =
    process.env.OCTO_SHOP_ID ||
    "43051";

const OCTO_SECRET =
    process.env.OCTO_SECRET ||
    "";

const OCTO_UNIQUE_KEY =
    process.env.OCTO_UNIQUE_KEY ||
    "";

const OCTO_TEST =
    String(process.env.OCTO_TEST || "false").toLowerCase() === "true";

const OCTO_LANGUAGE =
    process.env.OCTO_LANGUAGE ||
    "en";

const BRAND_APPLICATION_AMOUNT =
    Number(process.env.BRAND_APPLICATION_AMOUNT || 1);

const BRAND_APPLICATION_CURRENCY =
    String(process.env.BRAND_APPLICATION_CURRENCY || "USD").toUpperCase();

const SITE_NAME =
    process.env.SITE_NAME ||
    "ALL WORLD BRANDS";

const CONTACT_EMAIL =
    process.env.CONTACT_EMAIL ||
    "contact@allworldbrands.net";

const CONTACT_PHONE =
    process.env.CONTACT_PHONE ||
    "";

const CONTACT_WHATSAPP =
    process.env.CONTACT_WHATSAPP ||
    "";

const CONTACT_ADDRESS =
    process.env.CONTACT_ADDRESS ||
    "";

const CONTACT_HOURS =
    process.env.CONTACT_HOURS ||
    "";

const SITE_TAGLINE =
    process.env.SITE_TAGLINE ||
    "Bring your brand to the world.";

const OCTO_TTL_MINUTES = 15;

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

function makeOctoSignature(uuid, status) {
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

    const text = await response.text();

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
        octo_shop_id: OCTO_SHOP_ID,
        octo_secret: OCTO_SECRET,
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

    const text = await response.text();

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

const COUNTRY_LANGUAGE_MAP = {
    UZ: "uz",
    TR: "tr",
    GB: "en",
    US: "en",
    CA: "en",
    AU: "en",
    DE: "de",
    AT: "de",
    CH: "de",
    FR: "fr",
    ES: "es",
    IT: "it",
    PT: "pt",
    BR: "pt",
    RU: "ru",
    UA: "uk",
    KZ: "kk",
    KG: "ky",
    AZ: "az",
    CN: "zh",
    TW: "zh",
    JP: "ja",
    KR: "ko",
    IN: "en",
    AE: "ar",
    SA: "ar"
};

const COUNTRIES = [
    ["Afghanistan", "AF"],
    ["Albania", "AL"],
    ["Algeria", "DZ"],
    ["Andorra", "AD"],
    ["Angola", "AO"],
    ["Argentina", "AR"],
    ["Armenia", "AM"],
    ["Australia", "AU"],
    ["Austria", "AT"],
    ["Azerbaijan", "AZ"],
    ["Bahamas", "BS"],
    ["Bahrain", "BH"],
    ["Bangladesh", "BD"],
    ["Belarus", "BY"],
    ["Belgium", "BE"],
    ["Bolivia", "BO"],
    ["Bosnia and Herzegovina", "BA"],
    ["Brazil", "BR"],
    ["Bulgaria", "BG"],
    ["Cambodia", "KH"],
    ["Canada", "CA"],
    ["Chile", "CL"],
    ["China", "CN"],
    ["Colombia", "CO"],
    ["Croatia", "HR"],
    ["Cyprus", "CY"],
    ["Czech Republic", "CZ"],
    ["Denmark", "DK"],
    ["Ecuador", "EC"],
    ["Egypt", "EG"],
    ["Estonia", "EE"],
    ["Finland", "FI"],
    ["France", "FR"],
    ["Georgia", "GE"],
    ["Germany", "DE"],
    ["Ghana", "GH"],
    ["Greece", "GR"],
    ["Hungary", "HU"],
    ["Iceland", "IS"],
    ["India", "IN"],
    ["Indonesia", "ID"],
    ["Iran", "IR"],
    ["Iraq", "IQ"],
    ["Ireland", "IE"],
    ["Israel", "IL"],
    ["Italy", "IT"],
    ["Japan", "JP"],
    ["Jordan", "JO"],
    ["Kazakhstan", "KZ"],
    ["Kenya", "KE"],
    ["Kuwait", "KW"],
    ["Kyrgyzstan", "KG"],
    ["Latvia", "LV"],
    ["Lebanon", "LB"],
    ["Lithuania", "LT"],
    ["Luxembourg", "LU"],
    ["Malaysia", "MY"],
    ["Malta", "MT"],
    ["Mexico", "MX"],
    ["Moldova", "MD"],
    ["Monaco", "MC"],
    ["Mongolia", "MN"],
    ["Montenegro", "ME"],
    ["Morocco", "MA"],
    ["Nepal", "NP"],
    ["Netherlands", "NL"],
    ["New Zealand", "NZ"],
    ["Nigeria", "NG"],
    ["North Macedonia", "MK"],
    ["Norway", "NO"],
    ["Oman", "OM"],
    ["Pakistan", "PK"],
    ["Panama", "PA"],
    ["Peru", "PE"],
    ["Philippines", "PH"],
    ["Poland", "PL"],
    ["Portugal", "PT"],
    ["Qatar", "QA"],
    ["Romania", "RO"],
    ["Russia", "RU"],
    ["Saudi Arabia", "SA"],
    ["Serbia", "RS"],
    ["Singapore", "SG"],
    ["Slovakia", "SK"],
    ["Slovenia", "SI"],
    ["South Africa", "ZA"],
    ["South Korea", "KR"],
    ["Spain", "ES"],
    ["Sri Lanka", "LK"],
    ["Sweden", "SE"],
    ["Switzerland", "CH"],
    ["Taiwan", "TW"],
    ["Tajikistan", "TJ"],
    ["Thailand", "TH"],
    ["Tunisia", "TN"],
    ["Turkey", "TR"],
    ["Turkmenistan", "TM"],
    ["Ukraine", "UA"],
    ["United Arab Emirates", "AE"],
    ["United Kingdom", "GB"],
    ["United States", "US"],
    ["Uruguay", "UY"],
    ["Uzbekistan", "UZ"],
    ["Venezuela", "VE"],
    ["Vietnam", "VN"],
    ["Yemen", "YE"],
    ["Zambia", "ZM"],
    ["Zimbabwe", "ZW"]
];

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
            (name, code)
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

        const country = await dbGet(
            `
            SELECT id
            FROM countries
            WHERE code = ?
            LIMIT 1
            `,
            [code]
        );

        if (!country) continue;

        const exists = await dbGet(
            `
            SELECT id
            FROM brands
            WHERE name = ?
            AND country_id = ?
            LIMIT 1
            `,
            [name, country.id]
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

    console.log("Database initialized");
}

function adminAuth(req, res, next) {
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
            .send("Authentication required.");
    }

    const encoded =
        header.slice(6);

    let decoded;

    try {
        decoded = Buffer
            .from(encoded, "base64")
            .toString("utf8");
    } catch {
        return res
            .status(401)
            .send("Invalid authentication.");
    }

    const separator =
        decoded.indexOf(":");

    const suppliedUser =
        separator >= 0
            ? decoded.slice(0, separator)
            : "";

    const suppliedPassword =
        separator >= 0
            ? decoded.slice(separator + 1)
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
            .send("Invalid credentials.");
    }

    next();
}

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "ALL WORLD BRANDS",
        payment: {
            provider: "OCTO",
            configured: octoConfigured()
        }
    });
});

app.get("/api/site-config", (req, res) => {
    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    res.json({
        name: SITE_NAME,
        tagline: SITE_TAGLINE,
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
            email: CONTACT_EMAIL,
            phone: CONTACT_PHONE,
            whatsapp: CONTACT_WHATSAPP,
            address: CONTACT_ADDRESS,
            hours: CONTACT_HOURS
        },
        default_language: "en"
    });
});

app.get("/api/language", (req, res) => {
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
            req.headers["accept-language"] ||
            ""
        );

    const language =
        accepted
            .split(",")[0]
            .split("-")[0]
            .toLowerCase() ||
        "en";

    res.json({
        language,
        country: country || null
    });
});

app.get("/api/countries", async (req, res) => {
    try {
        const rows = await dbAll(`
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
        `);

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error:
                "Unable to load countries."
        });
    }
});

app.get(
    "/api/countries/:id/brands",
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid country ID."
                    });
            }

            const rows = await dbAll(
                `
                SELECT
                    b.*,
                    c.name AS country_name,
                    c.code AS country_code
                FROM brands b
                JOIN countries c
                    ON c.id = b.country_id
                WHERE b.country_id = ?
                ORDER BY b.name COLLATE NOCASE
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

app.get(
    "/api/brands/:id",
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid brand ID."
                    });
            }

            const brand = await dbGet(
                `
                SELECT
                    b.*,
                    c.name AS country_name,
                    c.code AS country_code
                FROM brands b
                JOIN countries c
                    ON c.id = b.country_id
                WHERE b.id = ?
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

app.get("/api/search", async (req, res) => {
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

        const rows = await dbAll(
            `
            SELECT
                b.*,
                c.name AS country_name,
                c.code AS country_code
            FROM brands b
            JOIN countries c
                ON c.id = b.country_id
            WHERE
                b.name LIKE ?
                OR b.category LIKE ?
                OR b.description LIKE ?
                OR c.name LIKE ?
            ORDER BY
                b.name COLLATE NOCASE
            LIMIT 100
            `,
            [
                pattern,
                pattern,
                pattern,
                pattern
            ]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error:
                "Search failed."
        });
    }
});

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

            if (!isValidEmail(email)) {
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
                    SELECT id, name, code
                    FROM countries
                    WHERE
                        name = ?
                        OR code = ?
                    LIMIT 1
                    `,
                    [country, country.toUpperCase()]
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
                payment_required: true,
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
                    already_paid: true,
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
                    (now - created) /
                    60000;

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
                        method: "bank_card"
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
                WHERE octo_transaction_id = ?
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

app.get(
    "/api/admin/applications",
    adminAuth,
    async (req, res) => {
        try {
            const rows =
                await dbAll(`
                    SELECT *
                    FROM applications
                    ORDER BY id DESC
                    LIMIT 500
                `);

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
                    VALUES (?, ?, ?, ?, ?, ?, ?)
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
                id: result.lastID
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

app.delete(
    "/api/admin/brands/:id",
    adminAuth,
    async (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid brand ID."
                    });
            }

            await dbRun(
                `
                DELETE FROM brands
                WHERE id = ?
                `,
                [id]
            );

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

app.get("/admin", adminAuth, (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">
<title>ALL WORLD BRANDS ADMIN</title>
<style>
body{
    font-family:Arial,sans-serif;
    background:#050914;
    color:#fff;
    padding:30px;
}
h1{margin-bottom:20px}
button{
    padding:10px 15px;
    cursor:pointer;
}
table{
    width:100%;
    border-collapse:collapse;
    margin-top:20px;
}
td,th{
    padding:10px;
    border:1px solid #333;
    text-align:left;
}
</style>
</head>
<body>
<h1>ALL WORLD BRANDS ADMIN</h1>
<p>Applications and payment statuses.</p>
<div id="data">Loading...</div>
<script>
fetch("/api/admin/applications")
.then(r=>r.json())
.then(rows=>{
    if(!Array.isArray(rows)){
        document.getElementById("data").textContent =
            "Unable to load.";
        return;
    }

    let html =
        "<table><tr>" +
        "<th>ID</th>" +
        "<th>Brand</th>" +
        "<th>Country</th>" +
        "<th>Email</th>" +
        "<th>Payment</th>" +
        "<th>Status</th>" +
        "</tr>";

    rows.forEach(x=>{
        html +=
            "<tr>" +
            "<td>"+escapeHtml(x.id)+"</td>" +
            "<td>"+escapeHtml(x.brand_name)+"</td>" +
            "<td>"+escapeHtml(x.country)+"</td>" +
            "<td>"+escapeHtml(x.email)+"</td>" +
            "<td>"+escapeHtml(x.payment_status)+"</td>" +
            "<td>"+escapeHtml(x.status)+"</td>" +
            "</tr>";
    });

    html += "</table>";

    document.getElementById("data").innerHTML = html;
})
.catch(()=>{
    document.getElementById("data").textContent =
        "Error.";
});

function escapeHtml(value){
    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}
</script>
</body>
</html>
    `);
});

app.use(
    express.static(
        path.join(__dirname, "public"),
        {
            extensions: ["html"]
        }
    )
);

app.get("*", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

initializeDatabase()
    .then(() => {
        app.listen(
            PORT,
            () => {
                console.log(
                    `ALL WORLD BRANDS running on port ${PORT}`
                );
                console.log(
                    `OCTO configured: ${octoConfigured()}`
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
