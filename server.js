const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const PORT = process.env.PORT || 3000;
const DB_FILE =
    process.env.DB_FILE || path.join(__dirname, "allworldbrands.db");

const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(PUBLIC_DIR, "admin");

const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA journal_mode = WAL");
});

/* =========================================================
   OCTO CONFIG
========================================================= */

const PUBLIC_BASE_URL =
    process.env.PUBLIC_BASE_URL || "https://allworldbrands.net";

const OCTO_SHOP_ID = Number(process.env.OCTO_SHOP_ID || 0);
const OCTO_SECRET = process.env.OCTO_SECRET || "";
const OCTO_UNIQUE_KEY = process.env.OCTO_UNIQUE_KEY || "";

const OCTO_TEST =
    String(process.env.OCTO_TEST || "true").toLowerCase() === "true";

const BRAND_APPLICATION_AMOUNT = Number(
    process.env.BRAND_APPLICATION_AMOUNT || 1
);

const BRAND_APPLICATION_CURRENCY =
    process.env.BRAND_APPLICATION_CURRENCY || "USD";

const OCTO_PREPARE_URL =
    "https://secure.octo.uz/prepare_payment";

const OCTO_NOTIFY_URL =
    `${PUBLIC_BASE_URL}/api/payments/octo/notify`;

const OCTO_RETURN_URL =
    `${PUBLIC_BASE_URL}/?payment=octo`;

const OCTO_LANGUAGE = "uz";
const OCTO_TTL = 15;


/* =========================================================
   DATABASE HELPERS
========================================================= */

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}


/* =========================================================
   DATABASE SCHEMA
========================================================= */

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS countries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            code TEXT
        )
    `);

    db.run(`
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

    db.run(`
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

    db.run(`
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

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});


/* =========================================================
   MIGRATION
========================================================= */

function addColumnIfMissing(table, column, definition) {
    return new Promise((resolve) => {

        db.all(
            `PRAGMA table_info(${table})`,
            [],
            (err, rows) => {

                if (err) {
                    console.error(
                        `PRAGMA error for ${table}:`,
                        err
                    );
                    return resolve();
                }

                const exists = rows.some(
                    row => row.name === column
                );

                if (exists) {
                    return resolve();
                }

                db.run(
                    `ALTER TABLE ${table}
                     ADD COLUMN ${column} ${definition}`,
                    [],
                    (alterErr) => {

                        if (alterErr) {
                            console.error(
                                `Migration error adding ${column}:`,
                                alterErr
                            );
                        }

                        resolve();
                    }
                );
            }
        );
    });
}


(async () => {

    await addColumnIfMissing(
        "countries",
        "code",
        "TEXT"
    );

    await addColumnIfMissing(
        "brands",
        "logo",
        "TEXT DEFAULT ''"
    );

    await addColumnIfMissing(
        "brands",
        "category",
        "TEXT DEFAULT ''"
    );

    await addColumnIfMissing(
        "brands",
        "description",
        "TEXT DEFAULT ''"
    );

    await addColumnIfMissing(
        "brands",
        "website",
        "TEXT DEFAULT ''"
    );

    await addColumnIfMissing(
        "brands",
        "verification",
        "TEXT DEFAULT 'Unverified'"
    );

    await addColumnIfMissing(
        "brands",
        "created_at",
        "DATETIME DEFAULT CURRENT_TIMESTAMP"
    );

    await addColumnIfMissing(
        "applications",
        "brand_name",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "country",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "owner_name",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "email",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "phone",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "website",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "logo",
        "TEXT DEFAULT ''"
    );

    await addColumnIfMissing(
        "applications",
        "description",
        "TEXT"
    );

    await addColumnIfMissing(
        "applications",
        "status",
        "TEXT DEFAULT 'new'"
    );

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
        "updated_at",
        "DATETIME DEFAULT CURRENT_TIMESTAMP"
    );

})();


/* =========================================================
   COUNTRIES
========================================================= */

const countries = [
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
    ["Belize", "BZ"],
    ["Benin", "BJ"],
    ["Bolivia", "BO"],
    ["Bosnia and Herzegovina", "BA"],
    ["Botswana", "BW"],
    ["Brazil", "BR"],
    ["Brunei", "BN"],
    ["Bulgaria", "BG"],
    ["Cambodia", "KH"],
    ["Cameroon", "CM"],
    ["Canada", "CA"],
    ["Chile", "CL"],
    ["China", "CN"],
    ["Colombia", "CO"],
    ["Costa Rica", "CR"],
    ["Croatia", "HR"],
    ["Cuba", "CU"],
    ["Cyprus", "CY"],
    ["Czech Republic", "CZ"],
    ["Denmark", "DK"],
    ["Dominican Republic", "DO"],
    ["Ecuador", "EC"],
    ["Egypt", "EG"],
    ["Estonia", "EE"],
    ["Ethiopia", "ET"],
    ["Finland", "FI"],
    ["France", "FR"],
    ["Georgia", "GE"],
    ["Germany", "DE"],
    ["Ghana", "GH"],
    ["Greece", "GR"],
    ["Guatemala", "GT"],
    ["Honduras", "HN"],
    ["Hong Kong", "HK"],
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
    ["Kuwait", "KW"],
    ["Kyrgyzstan", "KG"],
    ["Laos", "LA"],
    ["Latvia", "LV"],
    ["Lebanon", "LB"],
    ["Libya", "LY"],
    ["Lithuania", "LT"],
    ["Luxembourg", "LU"],
    ["Malaysia", "MY"],
    ["Maldives", "MV"],
    ["Malta", "MT"],
    ["Mauritius", "MU"],
    ["Mexico", "MX"],
    ["Moldova", "MD"],
    ["Monaco", "MC"],
    ["Mongolia", "MN"],
    ["Montenegro", "ME"],
    ["Morocco", "MA"],
    ["Mozambique", "MZ"],
    ["Myanmar", "MM"],
    ["Namibia", "NA"],
    ["Nepal", "NP"],
    ["Netherlands", "NL"],
    ["New Zealand", "NZ"],
    ["Nicaragua", "NI"],
    ["Nigeria", "NG"],
    ["North Macedonia", "MK"],
    ["Norway", "NO"],
    ["Oman", "OM"],
    ["Pakistan", "PK"],
    ["Panama", "PA"],
    ["Paraguay", "PY"],
    ["Peru", "PE"],
    ["Philippines", "PH"],
    ["Poland", "PL"],
    ["Portugal", "PT"],
    ["Qatar", "QA"],
    ["Romania", "RO"],
    ["Russia", "RU"],
    ["Rwanda", "RW"],
    ["Saudi Arabia", "SA"],
    ["Senegal", "SN"],
    ["Serbia", "RS"],
    ["Singapore", "SG"],
    ["Slovakia", "SK"],
    ["Slovenia", "SI"],
    ["South Africa", "ZA"],
    ["South Korea", "KR"],
    ["Spain", "ES"],
    ["Sri Lanka", "LK"],
    ["Sudan", "SD"],
    ["Sweden", "SE"],
    ["Switzerland", "CH"],
    ["Syria", "SY"],
    ["Taiwan", "TW"],
    ["Tajikistan", "TJ"],
    ["Tanzania", "TZ"],
    ["Thailand", "TH"],
    ["Tunisia", "TN"],
    ["Türkiye", "TR"],
    ["Turkmenistan", "TM"],
    ["Uganda", "UG"],
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
    ["Zimbabwe", "ZW"],

    ["American Samoa", "AS"],
    ["Anguilla", "AI"],
    ["Antarctica", "AQ"],
    ["Aruba", "AW"],
    ["Bermuda", "BM"],
    ["Bhutan", "BT"],
    ["Bouvet Island", "BV"],
    ["British Virgin Islands", "VG"],
    ["Cayman Islands", "KY"],
    ["Christmas Island", "CX"],
    ["Cocos (Keeling) Islands", "CC"],
    ["Cook Islands", "CK"],
    ["Curaçao", "CW"],
    ["Falkland Islands", "FK"],
    ["Faroe Islands", "FO"],
    ["French Guiana", "GF"],
    ["French Polynesia", "PF"],
    ["Gibraltar", "GI"],
    ["Greenland", "GL"],
    ["Guadeloupe", "GP"],
    ["Guam", "GU"],
    ["Guernsey", "GG"],
    ["Isle of Man", "IM"],
    ["Jersey", "JE"],
    ["Macau", "MO"],
    ["Martinique", "MQ"],
    ["Mayotte", "YT"],
    ["Montserrat", "MS"],
    ["New Caledonia", "NC"],
    ["Niue", "NU"],
    ["Norfolk Island", "NF"],
    ["Northern Mariana Islands", "MP"],
    ["Pitcairn", "PN"],
    ["Puerto Rico", "PR"],
    ["Réunion", "RE"],
    ["Saint Barthélemy", "BL"],
    ["Saint Helena", "SH"],
    ["Saint Martin", "MF"],
    ["Saint Pierre and Miquelon", "PM"],
    ["Sint Maarten", "SX"],
    ["South Georgia and the South Sandwich Islands", "GS"],
    ["Tokelau", "TK"],
    ["Turks and Caicos Islands", "TC"],
    ["U.S. Virgin Islands", "VI"],
    ["Wallis and Futuna", "WF"],
    ["Western Sahara", "EH"]
];


(async () => {

    for (const [name, code] of countries) {

        try {

            await dbRun(
                `
                INSERT OR IGNORE INTO countries
                (name, code)
                VALUES (?, ?)
                `,
                [name, code]
            );

        } catch (err) {
            console.error(
                "Country seed error:",
                name,
                err.message
            );
        }

    }

})();


/* =========================================================
   STARTER BRANDS
========================================================= */

const starterBrands = [
    [
        "United States",
        "Apple",
        "Electronics",
        "Technology brand profile.",
        "https://www.apple.com"
    ],
    [
        "United States",
        "Nike",
        "Sports",
        "Sportswear and footwear brand profile.",
        "https://www.nike.com"
    ],
    [
        "United Kingdom",
        "Burberry",
        "Luxury",
        "British luxury fashion brand profile.",
        "https://www.burberry.com"
    ],
    [
        "Germany",
        "BMW",
        "Automotive",
        "German automotive brand profile.",
        "https://www.bmw.com"
    ],
    [
        "France",
        "L'Oréal",
        "Cosmetics",
        "Beauty brand profile.",
        "https://www.loreal.com"
    ],
    [
        "Italy",
        "Ferrari",
        "Automotive",
        "Italian automotive brand profile.",
        "https://www.ferrari.com"
    ],
    [
        "Türkiye",
        "Arçelik",
        "Home",
        "Home appliances brand profile.",
        "https://www.arcelik.com.tr"
    ],
    [
        "Uzbekistan",
        "Artel",
        "Electronics",
        "Uzbek consumer electronics brand profile.",
        "https://artelelectronics.com"
    ],
    [
        "Japan",
        "Toyota",
        "Automotive",
        "Japanese automotive brand profile.",
        "https://global.toyota"
    ],
    [
        "South Korea",
        "Samsung",
        "Electronics",
        "Technology brand profile.",
        "https://www.samsung.com"
    ],
    [
        "China",
        "Huawei",
        "Electronics",
        "Technology brand profile.",
        "https://www.huawei.com"
    ],
    [
        "India",
        "Tata",
        "Industrial",
        "Business group profile.",
        "https://www.tata.com"
    ]
];


(async () => {

    const countRow = await dbGet(
        "SELECT COUNT(*) AS count FROM brands"
    );

    if (Number(countRow?.count || 0) > 0) {
        return;
    }

    for (const item of starterBrands) {

        const [
            countryName,
            brandName,
            category,
            description,
            website
        ] = item;

        const country = await dbGet(
            "SELECT id FROM countries WHERE name = ?",
            [countryName]
        );

        if (!country) continue;

        await dbRun(
            `
            INSERT INTO brands
            (
                country_id,
                name,
                category,
                description,
                website,
                verification
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                country.id,
                brandName,
                category,
                description,
                website,
                "Official source"
            ]
        );
    }

})();


/* =========================================================
   MODERATION
========================================================= */

const ADULT_CONTENT_WORDS = [
    "porn",
    "porno",
    "pornography",
    "pornographic",
    "xxx",
    "nsfw",
    "sexcam",
    "adultcam",
    "sex video",
    "porn video",
    "pornhub",
    "xvideos",
    "xnxx",
    "redtube",
    "hentai",
    "nude",
    "nudity"
];

function normalizeForModeration(value) {

    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function containsAdultContent(value) {

    const text = normalizeForModeration(value);

    return ADULT_CONTENT_WORDS.some(
        word => text.includes(word)
    );
}

function isBlockedContent(...values) {

    return values.some(
        value => containsAdultContent(value)
    );
}


/* =========================================================
   URL VALIDATION
========================================================= */

function isSafeUrl(value) {

    if (!value) return true;

    const url = String(value).trim();

    if (url.length > 2048) {
        return false;
    }

    if (/[\u0000-\u001f\u007f]/.test(url)) {
        return false;
    }

    if (/^(javascript|data|vbscript|file|blob):/i.test(url)) {
        return false;
    }

    if (/^https?:\/\//i.test(url)) {
        return true;
    }

    if (/^\/[^/]/.test(url)) {
        return true;
    }

    return false;
}


/* =========================================================
   APP MIDDLEWARE
========================================================= */

app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(morgan("tiny"));

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
   ADMIN AUTH
========================================================= */

const ADMIN_USER =
    process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "";

function adminAuth(req, res, next) {

    if (!ADMIN_PASSWORD) {

        return res
            .status(500)
            .send("Admin password is not configured.");

    }

    const auth =
        req.headers.authorization || "";

    if (!auth.startsWith("Basic ")) {

        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res
            .status(401)
            .send("Admin login required.");

    }

    let decoded;

    try {

        decoded = Buffer
            .from(auth.substring(6), "base64")
            .toString("utf8");

    } catch {

        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res
            .status(401)
            .send("Invalid authentication.");

    }

    const separator =
        decoded.indexOf(":");

    if (separator === -1) {

        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res
            .status(401)
            .send("Invalid authentication.");

    }

    const username =
        decoded.substring(0, separator);

    const password =
        decoded.substring(separator + 1);

    if (
        username !== ADMIN_USER ||
        password !== ADMIN_PASSWORD
    ) {

        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res
            .status(401)
            .send("Wrong username or password.");

    }

    next();
}


/* =========================================================
   ADMIN STATIC
========================================================= */

app.get(
    "/admin",
    adminAuth,
    (req, res) => {
        res.sendFile(
            path.join(
                ADMIN_DIR,
                "admin.html"
            )
        );
    }
);

app.get(
    "/admin/",
    adminAuth,
    (req, res) => {
        res.sendFile(
            path.join(
                ADMIN_DIR,
                "admin.html"
            )
        );
    }
);

app.get(
    "/admin/admin.html",
    adminAuth,
    (req, res) => {
        res.sendFile(
            path.join(
                ADMIN_DIR,
                "admin.html"
            )
        );
    }
);

app.use(
    "/admin",
    adminAuth,
    express.static(ADMIN_DIR, {
        index: false
    })
);


/* =========================================================
   PUBLIC STATIC
========================================================= */

app.use(
    express.static(PUBLIC_DIR)
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            const row = await dbGet(
                "SELECT COUNT(*) AS count FROM countries"
            );

            res.json({
                ok: true,
                service: "ALL WORLD BRANDS API",
                countries: Number(row?.count || 0),
                octo_configured: octoConfigured()
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                ok: false,
                error: "Database error"
            });

        }
    }
);


/* =========================================================
   COUNTRIES
========================================================= */

app.get(
    "/api/countries",
    async (req, res) => {

        try {

            const rows = await dbAll(`
                SELECT
                    c.*,
                    COUNT(b.id) AS brand_count
                FROM countries c
                LEFT JOIN brands b
                    ON b.country_id = c.id
                GROUP BY c.id
                ORDER BY c.name COLLATE NOCASE
            `);

            res.json(rows);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Could not load countries."
            });

        }
    }
);


/* =========================================================
   COUNTRY DETAILS
========================================================= */

app.get(
    "/api/countries/:id",
    async (req, res) => {

        try {

            const country =
                await dbGet(
                    `
                    SELECT
                        c.*,
                        COUNT(b.id) AS brand_count
                    FROM countries c
                    LEFT JOIN brands b
                        ON b.country_id = c.id
                    WHERE c.id = ?
                    GROUP BY c.id
                    `,
                    [req.params.id]
                );

            if (!country) {

                return res
                    .status(404)
                    .json({
                        error: "Country not found."
                    });

            }

            res.json(country);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Could not load country."
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

            const rows = await dbAll(
                `
                SELECT
                    brands.*,
                    countries.name AS country_name,
                    countries.code AS country_code
                FROM brands
                LEFT JOIN countries
                    ON brands.country_id = countries.id
                WHERE brands.country_id = ?
                ORDER BY brands.name COLLATE NOCASE
                `,
                [req.params.id]
            );

            res.json(rows);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Could not load brands."
            });

        }
    }
);


/* =========================================================
   BRAND DETAILS
========================================================= */

app.get(
    "/api/brands/:id",
    async (req, res) => {

        try {

            const brand =
                await dbGet(
                    `
                    SELECT
                        brands.*,
                        countries.name AS country_name,
                        countries.code AS country_code
                    FROM brands
                    LEFT JOIN countries
                        ON brands.country_id = countries.id
                    WHERE brands.id = ?
                    `,
                    [req.params.id]
                );

            if (!brand) {

                return res
                    .status(404)
                    .json({
                        error: "Brand not found."
                    });

            }

            brand.factories =
                await dbAll(
                    `
                    SELECT *
                    FROM factories
                    WHERE brand_id = ?
                    ORDER BY name COLLATE NOCASE
                    `,
                    [req.params.id]
                );

            res.json(brand);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Could not load brand."
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
                String(req.query.q || "")
                    .trim();

            if (!q) {
                return res.json([]);
            }

            const search = `%${q}%`;

            const rows =
                await dbAll(
                    `
                    SELECT
                        brands.id,
                        brands.name,
                        brands.logo,
                        brands.category,
                        brands.description,
                        brands.website,
                        brands.verification,
                        countries.name AS country_name,
                        countries.code AS country_code
                    FROM brands
                    LEFT JOIN countries
                        ON brands.country_id = countries.id
                    WHERE
                        brands.name LIKE ?
                        OR brands.category LIKE ?
                        OR brands.description LIKE ?
                        OR countries.name LIKE ?
                    ORDER BY brands.name COLLATE NOCASE
                    LIMIT 100
                    `,
                    [
                        search,
                        search,
                        search,
                        search
                    ]
                );

            res.json(rows);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Search failed."
            });

        }
    }
);


/* =========================================================
   PUBLIC APPLICATION
========================================================= */

app.post(
    "/api/applications",
    async (req, res) => {

        try {

            const x = req.body || {};

            const brandName =
                String(
                    x.brand_name ||
                    x.name ||
                    ""
                ).trim();

            const country =
                String(
                    x.country || ""
                ).trim();

            const ownerName =
                String(
                    x.owner_name ||
                    x.name ||
                    ""
                ).trim();

            const email =
                String(
                    x.email ||
                    ""
                ).trim();

            const phone =
                String(
                    x.phone ||
                    ""
                ).trim();

            const website =
                String(
                    x.website ||
                    ""
                ).trim();

            const logo =
                String(
                    x.logo ||
                    ""
                ).trim();

            const description =
                String(
                    x.description ||
                    x.message ||
                    ""
                ).trim();

            if (
                !brandName ||
                !country ||
                !email
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Brand name, country and email are required."
                    });

            }

            if (
                isBlockedContent(
                    brandName,
                    country,
                    ownerName,
                    email,
                    phone,
                    website,
                    description
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "The submitted content is not allowed."
                    });

            }

            if (
                website &&
                !isSafeUrl(website)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid website URL."
                    });

            }

            if (
                logo &&
                !isSafeUrl(logo)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid logo URL."
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
                        payment_currency
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        brandName,
                        country,
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
                id: result.lastID,
                status: "new",
                payment_status: "unpaid"
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not create application."
            });

        }
    }
);


/* =========================================================
   OCTO HELPERS
========================================================= */

function octoConfigured() {

    return (
        Number.isFinite(OCTO_SHOP_ID) &&
        OCTO_SHOP_ID > 0 &&
        Boolean(OCTO_SECRET)
    );
}


function generateTransactionId(applicationId) {

    return [
        `AWB-${applicationId}`,
        Date.now(),
        crypto.randomBytes(6).toString("hex")
    ].join("-");

}


/*
 * OCTO requires:
 * yyyy-MM-dd HH:mm:ss
 *
 * This replaces ISO:
 * 2026-09-21T12:30:00.000Z
 *
 * with:
 * 2026-09-21 12:30:00
 */
function formatOctoDate(date = new Date()) {

    const pad = value =>
        String(value).padStart(2, "0");

    return [
        date.getFullYear(),
        "-",
        pad(date.getMonth() + 1),
        "-",
        pad(date.getDate()),
        " ",
        pad(date.getHours()),
        ":",
        pad(date.getMinutes()),
        ":",
        pad(date.getSeconds())
    ].join("");

}


function sha1(value) {

    return crypto
        .createHash("sha1")
        .update(String(value), "utf8")
        .digest("hex");

}


function verifyOctoSignature(
    uuid,
    status,
    signature
) {

    if (!OCTO_UNIQUE_KEY) {
        return true;
    }

    if (!uuid || !status || !signature) {
        return false;
    }

    const expected =
        sha1(
            OCTO_UNIQUE_KEY +
            uuid +
            status
        );

    return (
        String(signature).toLowerCase() ===
        expected.toLowerCase()
    );

}


function normalizeOctoStatus(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();

}


const OCTO_SUCCESS_STATUSES = new Set([
    "paid",
    "success",
    "succeeded",
    "completed",
    "captured"
]);

const OCTO_CANCELLED_STATUSES = new Set([
    "cancelled",
    "canceled",
    "cancel",
    "expired"
]);

const OCTO_FAILED_STATUSES = new Set([
    "failed",
    "failure",
    "declined",
    "error"
]);


/*
 * OCTO response helper.
 *
 * IMPORTANT FIX:
 * HTTP 200 alone is NOT enough.
 * OCTO also returns:
 *
 * {
 *   "error": 0,
 *   "data": {...}
 * }
 *
 * Therefore we check both HTTP status
 * and OCTO "error".
 */
async function parseOctoResponse(response) {

    const text =
        await response.text();

    let json = {};

    try {
        json = text
            ? JSON.parse(text)
            : {};
    } catch {

        throw new Error(
            "OCTO returned invalid JSON."
        );

    }

    if (!response.ok) {

        const errorMessage =
            json?.data?.error_message ||
            json?.error_message ||
            json?.message ||
            `OCTO HTTP ${response.status}`;

        throw new Error(
            errorMessage
        );

    }

    const octoError =
        json?.error ??
        json?.data?.error;

    if (
        octoError !== undefined &&
        Number(octoError) !== 0
    ) {

        const errorMessage =
            json?.error_message ||
            json?.data?.error_message ||
            json?.message ||
            `OCTO error: ${octoError}`;

        throw new Error(
            errorMessage
        );

    }

    return json;

}


/* =========================================================
   OCTO STATUS
========================================================= */

async function getOctoPaymentStatus(
    transactionId
) {

    if (!octoConfigured()) {

        throw new Error(
            "OCTO is not configured."
        );

    }

    const response =
        await fetch(
            OCTO_PREPARE_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    octo_shop_id:
                        OCTO_SHOP_ID,

                    octo_secret:
                        OCTO_SECRET,

                    shop_transaction_id:
                        transactionId
                })
            }
        );

    return await parseOctoResponse(
        response
    );

}


/* =========================================================
   CREATE OCTO PAYMENT
========================================================= */

app.post(
    "/api/payments/octo/create",
    async (req, res) => {

        try {

            if (!octoConfigured()) {

                return res
                    .status(503)
                    .json({
                        error:
                            "OCTO payment is not configured."
                    });

            }

            const applicationId =
                Number(
                    req.body?.application_id
                );

            if (
                !Number.isInteger(
                    applicationId
                ) ||
                applicationId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid application_id."
                    });

            }

            const application =
                await dbGet(
                    `
                    SELECT *
                    FROM applications
                    WHERE id = ?
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
                String(
                    application.payment_status
                ).toLowerCase() === "paid"
            ) {

                return res
                    .status(409)
                    .json({
                        error:
                            "This application is already paid."
                    });

            }

            const transactionId =
                generateTransactionId(
                    application.id
                );

            const returnUrl =
                `${OCTO_RETURN_URL}` +
                `&application_id=${encodeURIComponent(
                    application.id
                )}`;

            const payload = {

                octo_shop_id:
                    OCTO_SHOP_ID,

                octo_secret:
                    OCTO_SECRET,

                shop_transaction_id:
                    transactionId,

                auto_capture:
                    true,

                test:
                    OCTO_TEST,

                /*
                 * FIX #1:
                 *
                 * OCTO expects:
                 * yyyy-MM-dd HH:mm:ss
                 *
                 * NOT:
                 * new Date().toISOString()
                 */
                init_time:
                    formatOctoDate(),

                total_sum:
                    Number(
                        application.payment_amount ||
                        BRAND_APPLICATION_AMOUNT
                    ),

                currency:
                    application.payment_currency ||
                    BRAND_APPLICATION_CURRENCY,

                description:
                    `ALL WORLD BRANDS - Brand application #${application.id}`,

                language:
                    OCTO_LANGUAGE,

                ttl:
                    OCTO_TTL,

                payment_methods: [
                    {
                        method: "bank_card"
                    }
                ],

                return_url:
                    returnUrl,

                notify_url:
                    OCTO_NOTIFY_URL,

                user_data: {
                    user_id:
                        String(application.id)
                }
            };


            const response =
                await fetch(
                    OCTO_PREPARE_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


            /*
             * FIX #2:
             *
             * We now check:
             *
             * 1. HTTP status
             * 2. OCTO error field
             * 3. data object
             */
            const result =
                await parseOctoResponse(
                    response
                );


            const data =
                result?.data ||
                result;


            const paymentUrl =
                data?.octo_pay_url ||
                data?.payment_url ||
                data?.pay_url ||
                result?.octo_pay_url ||
                result?.payment_url;


            const paymentUuid =
                data?.octo_payment_UUID ||
                data?.octo_payment_uuid ||
                result?.octo_payment_UUID ||
                result?.octo_payment_uuid ||
                null;


            if (!paymentUrl) {

                console.error(
                    "OCTO response without payment URL:",
                    result
                );

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
                    octo_transaction_id = ?,
                    octo_payment_uuid = ?,
                    payment_status = 'pending',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    transactionId,
                    paymentUuid,
                    application.id
                ]
            );


            return res.json({

                ok: true,

                application_id:
                    application.id,

                transaction_id:
                    transactionId,

                payment_uuid:
                    paymentUuid,

                payment_url:
                    paymentUrl,

                amount:
                    Number(
                        application.payment_amount ||
                        BRAND_APPLICATION_AMOUNT
                    ),

                currency:
                    application.payment_currency ||
                    BRAND_APPLICATION_CURRENCY

            });

        } catch (err) {

            console.error(
                "OCTO CREATE ERROR:",
                err
            );

            return res
                .status(502)
                .json({
                    error:
                        err.message ||
                        "OCTO payment creation failed."
                });

        }

    }
);


/* =========================================================
   OCTO NOTIFY
========================================================= */

app.post(
    "/api/payments/octo/notify",
    async (req, res) => {

        try {

            const body =
                req.body || {};

            const transactionId =
                body.shop_transaction_id ||
                body.transaction_id ||
                "";

            const uuid =
                body.octo_payment_UUID ||
                body.octo_payment_uuid ||
                "";

            const status =
                body.status ||
                "";

            const signature =
                body.signature ||
                "";

            const callbackAmount =
                body.total_sum;

            const callbackCurrency =
                body.currency;


            if (!transactionId) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Missing shop_transaction_id."
                    });

            }


            const application =
                await dbGet(
                    `
                    SELECT *
                    FROM applications
                    WHERE octo_transaction_id = ?
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
                OCTO_UNIQUE_KEY &&
                !verifyOctoSignature(
                    uuid,
                    status,
                    signature
                )
            ) {

                console.error(
                    "Invalid OCTO signature."
                );

                return res
                    .status(403)
                    .json({
                        error:
                            "Invalid signature."
                    });

            }


            /*
             * Ask OCTO directly for the current
             * payment state.
             */
            let statusResponse;

            try {

                statusResponse =
                    await getOctoPaymentStatus(
                        transactionId
                    );

            } catch (statusError) {

                console.error(
                    "OCTO status verification failed:",
                    statusError
                );

                return res
                    .status(502)
                    .json({
                        error:
                            "Could not verify payment status."
                    });

            }


            const statusData =
                statusResponse?.data ||
                statusResponse ||
                {};


            const realStatus =
                normalizeOctoStatus(
                    statusData.status ||
                    status
                );


            /*
             * Verify amount/currency from callback
             * when OCTO provides them.
             */
            if (
                callbackAmount !== undefined &&
                callbackAmount !== null &&
                callbackAmount !== ""
            ) {

                const expectedAmount =
                    Number(
                        application.payment_amount ||
                        BRAND_APPLICATION_AMOUNT
                    );

                const receivedAmount =
                    Number(
                        callbackAmount
                    );

                if (
                    !Number.isFinite(
                        receivedAmount
                    ) ||
                    receivedAmount !== expectedAmount
                ) {

                    console.error(
                        "OCTO amount mismatch:",
                        {
                            expected:
                                expectedAmount,
                            received:
                                receivedAmount
                        }
                    );

                    return res
                        .status(400)
                        .json({
                            error:
                                "Payment amount mismatch."
                        });

                }

            }


            if (
                callbackCurrency &&
                String(
                    callbackCurrency
                ).toUpperCase() !==
                String(
                    application.payment_currency ||
                    BRAND_APPLICATION_CURRENCY
                ).toUpperCase()
            ) {

                console.error(
                    "OCTO currency mismatch."
                );

                return res
                    .status(400)
                    .json({
                        error:
                            "Payment currency mismatch."
                    });

            }


            if (
                OCTO_SUCCESS_STATUSES.has(
                    realStatus
                )
            ) {

                await dbRun(
                    `
                    UPDATE applications
                    SET
                        payment_status = 'paid',
                        octo_payment_uuid = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [
                        uuid ||
                        application.octo_payment_uuid ||
                        null,
                        application.id
                    ]
                );

            } else if (
                OCTO_CANCELLED_STATUSES.has(
                    realStatus
                )
            ) {

                await dbRun(
                    `
                    UPDATE applications
                    SET
                        payment_status = 'cancelled',
                        octo_payment_uuid = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [
                        uuid ||
                        application.octo_payment_uuid ||
                        null,
                        application.id
                    ]
                );

            } else if (
                OCTO_FAILED_STATUSES.has(
                    realStatus
                )
            ) {

                await dbRun(
                    `
                    UPDATE applications
                    SET
                        payment_status = 'failed',
                        octo_payment_uuid = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [
                        uuid ||
                        application.octo_payment_uuid ||
                        null,
                        application.id
                    ]
                );

            } else {

                await dbRun(
                    `
                    UPDATE applications
                    SET
                        payment_status = 'pending',
                        octo_payment_uuid = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [
                        uuid ||
                        application.octo_payment_uuid ||
                        null,
                        application.id
                    ]
                );

            }


            return res.json({
                ok: true
            });

        } catch (err) {

            console.error(
                "OCTO NOTIFY ERROR:",
                err
            );

            return res
                .status(500)
                .json({
                    error:
                        "Notification processing failed."
                });

        }

    }
);


/* =========================================================
   OCTO PAYMENT STATUS
========================================================= */

app.get(
    "/api/payments/octo/status/:id",
    async (req, res) => {

        try {

            const applicationId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    applicationId
                ) ||
                applicationId <= 0
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
                String(
                    application.payment_status
                ).toLowerCase() === "paid"
            ) {

                return res.json({
                    ok: true,
                    application_id:
                        application.id,
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
                        application.id,
                    payment_status:
                        application.payment_status ||
                        "unpaid"
                });

            }


            const result =
                await getOctoPaymentStatus(
                    application.octo_transaction_id
                );


            const data =
                result?.data ||
                result ||
                {};


            const status =
                normalizeOctoStatus(
                    data.status
                );


            let paymentStatus =
                application.payment_status ||
                "pending";


            if (
                OCTO_SUCCESS_STATUSES.has(
                    status
                )
            ) {

                /*
                 * OCTO status endpoint officially
                 * confirms current state.
                 *
                 * Amount/currency are not assumed
                 * from fields that may not exist in
                 * the status response.
                 */
                paymentStatus =
                    "paid";

            } else if (
                OCTO_CANCELLED_STATUSES.has(
                    status
                )
            ) {

                paymentStatus =
                    "cancelled";

            } else if (
                OCTO_FAILED_STATUSES.has(
                    status
                )
            ) {

                paymentStatus =
                    "failed";

            } else {

                paymentStatus =
                    "pending";

            }


            await dbRun(
                `
                UPDATE applications
                SET
                    payment_status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    paymentStatus,
                    application.id
                ]
            );


            return res.json({
                ok: true,
                application_id:
                    application.id,
                transaction_id:
                    application.octo_transaction_id,
                payment_status:
                    paymentStatus,
                octo_status:
                    status
            });

        } catch (err) {

            console.error(
                "OCTO STATUS ERROR:",
                err
            );

            return res
                .status(502)
                .json({
                    error:
                        err.message ||
                        "Could not check OCTO payment status."
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
                    ORDER BY created_at DESC, id DESC
                    `
                );

            res.json(rows);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not load applications."
            });

        }
    }
);


/* =========================================================
   ADMIN APPLICATION STATUS
========================================================= */

app.patch(
    "/api/admin/applications/:id",
    adminAuth,
    async (req, res) => {

        try {

            const status =
                String(
                    req.body?.status ||
                    "new"
                ).trim();

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
                    req.params.id
                ]
            );

            res.json({
                ok: true
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not update application."
            });

        }
    }
);


/* =========================================================
   ADMIN MANUAL PAYMENT STATUS
========================================================= */

app.patch(
    "/api/admin/applications/:id/payment",
    adminAuth,
    async (req, res) => {

        try {

            const paymentStatus =
                String(
                    req.body?.payment_status ||
                    "unpaid"
                ).trim().toLowerCase();

            const allowed = [
                "unpaid",
                "pending",
                "paid",
                "failed",
                "cancelled"
            ];

            if (
                !allowed.includes(
                    paymentStatus
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid payment status."
                    });

            }

            await dbRun(
                `
                UPDATE applications
                SET
                    payment_status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    paymentStatus,
                    req.params.id
                ]
            );

            res.json({
                ok: true,
                payment_status:
                    paymentStatus
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not update payment status."
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
                        brands.*,
                        countries.name AS country_name,
                        countries.code AS country_code
                    FROM brands
                    LEFT JOIN countries
                        ON brands.country_id =
                           countries.id
                    ORDER BY brands.id DESC
                    `
                );

            res.json(rows);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not load brands."
            });

        }
    }
);


/* =========================================================
   ADMIN BRAND CREATE
========================================================= */

app.post(
    "/api/admin/brands",
    adminAuth,
    async (req, res) => {

        try {

            const name =
                String(
                    req.body?.name ||
                    ""
                ).trim();

            const countryId =
                Number(
                    req.body?.country_id
                );

            const category =
                String(
                    req.body?.category ||
                    ""
                ).trim();

            const description =
                String(
                    req.body?.description ||
                    ""
                ).trim();

            const website =
                String(
                    req.body?.website ||
                    ""
                ).trim();

            const logo =
                String(
                    req.body?.logo ||
                    ""
                ).trim();

            const verification =
                String(
                    req.body?.verification ||
                    "Unverified"
                ).trim();


            if (!name) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Brand name is required."
                    });

            }


            if (
                isBlockedContent(
                    name,
                    category,
                    description,
                    website
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "The submitted content is not allowed."
                    });

            }


            if (
                website &&
                !isSafeUrl(website)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid website URL."
                    });

            }


            if (
                logo &&
                !isSafeUrl(logo)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid logo URL."
                    });

            }


            let validCountryId =
                Number.isInteger(
                    countryId
                ) &&
                countryId > 0
                    ? countryId
                    : null;


            if (validCountryId) {

                const country =
                    await dbGet(
                        `
                        SELECT id
                        FROM countries
                        WHERE id = ?
                        `,
                        [validCountryId]
                    );

                if (!country) {
                    validCountryId = null;
                }

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
                        validCountryId,
                        name,
                        logo,
                        category,
                        description,
                        website,
                        verification
                    ]
                );


            res.json({
                ok: true,
                id: result.lastID
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not create brand."
            });

        }

    }
);


/* =========================================================
   ADMIN BRAND UPDATE
========================================================= */

app.patch(
    "/api/admin/brands/:id",
    adminAuth,
    async (req, res) => {

        try {

            const current =
                await dbGet(
                    `
                    SELECT *
                    FROM brands
                    WHERE id = ?
                    `,
                    [req.params.id]
                );


            if (!current) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Brand not found."
                    });

            }


            const name =
                String(
                    req.body?.name ??
                    current.name ??
                    ""
                ).trim();

            const countryId =
                Number(
                    req.body?.country_id ??
                    current.country_id
                );

            const category =
                String(
                    req.body?.category ??
                    current.category ??
                    ""
                ).trim();

            const description =
                String(
                    req.body?.description ??
                    current.description ??
                    ""
                ).trim();

            const website =
                String(
                    req.body?.website ??
                    current.website ??
                    ""
                ).trim();

            const logo =
                String(
                    req.body?.logo ??
                    current.logo ??
                    ""
                ).trim();

            const verification =
                String(
                    req.body?.verification ??
                    current.verification ??
                    "Unverified"
                ).trim();


            if (!name) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Brand name is required."
                    });

            }


            if (
                isBlockedContent(
                    name,
                    category,
                    description,
                    website
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "The submitted content is not allowed."
                    });

            }


            if (
                website &&
                !isSafeUrl(website)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid website URL."
                    });

            }


            if (
                logo &&
                !isSafeUrl(logo)
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Invalid logo URL."
                    });

            }


            await dbRun(
                `
                UPDATE brands
                SET
                    country_id = ?,
                    name = ?,
                    logo = ?,
                    category = ?,
                    description = ?,
                    website = ?,
                    verification = ?
                WHERE id = ?
                `,
                [
                    Number.isInteger(countryId)
                        ? countryId
                        : current.country_id,
                    name,
                    logo,
                    category,
                    description,
                    website,
                    verification,
                    req.params.id
                ]
            );


            res.json({
                ok: true
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not update brand."
            });

        }

    }
);


/* =========================================================
   ADMIN BRAND DELETE
========================================================= */

app.delete(
    "/api/admin/brands/:id",
    adminAuth,
    async (req, res) => {

        try {

            await dbRun(
                `
                DELETE FROM brands
                WHERE id = ?
                `,
                [req.params.id]
            );

            res.json({
                ok: true
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error:
                    "Could not delete brand."
            });

        }

    }
);


/* =========================================================
   FRONTEND FALLBACK
========================================================= */

app.use(
    (req, res, next) => {

        if (
            req.method !== "GET"
        ) {
            return next();
        }

        if (
            req.path.startsWith("/api/") ||
            req.path.startsWith("/admin")
        ) {
            return next();
        }

        const indexFile =
            path.join(
                PUBLIC_DIR,
                "index.html"
            );

        if (
            fs.existsSync(indexFile)
        ) {
            return res.sendFile(
                indexFile
            );
        }

        next();

    }
);


/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({
            error: "Not found."
        });

    }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (err, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            err
        );

        res.status(500).json({
            error:
                "Internal server error."
        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log(
                `ALL WORLD BRANDS running on port ${PORT}`
            );

            console.log(
                `OCTO configured: ${octoConfigured()}`
            );

            console.log(
                `OCTO test mode: ${OCTO_TEST}`
            );

            console.log(
                `OCTO notify URL: ${OCTO_NOTIFY_URL}`
            );

        }
    );


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(signal) {

    console.log(
        `${signal} received. Shutting down...`
    );

    server.close(() => {

        db.close(() => {

            console.log(
                "Database closed."
            );

            process.exit(0);

        });

    });

}


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);
