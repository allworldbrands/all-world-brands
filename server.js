const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const PORT = process.env.PORT || 3000;

const PUBLIC_BASE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const OCTO_SHOP_ID = Number(
    process.env.OCTO_SHOP_ID || 43051
);

const OCTO_SECRET =
    process.env.OCTO_SECRET || "";

const OCTO_API_URL =
    "https://secure.octo.uz/prepare_payment";

const OCTO_TEST =
    String(
        process.env.OCTO_TEST || "true"
    ).toLowerCase() === "true";

const PAYMENT_AMOUNT = 1000;
const PAYMENT_CURRENCY = "UZS";

const DB_DIR =
    path.join(__dirname, "data");

const DB_FILE =
    process.env.DB_PATH ||
    path.join(DB_DIR, "database.sqlite");


/* =========================================================
   APP
========================================================= */

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

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================================
   DATABASE
========================================================= */

const fs = require("fs");

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, {
        recursive: true
    });
}

const db =
    new sqlite3.Database(DB_FILE);

db.serialize(() => {

    db.run(`
        PRAGMA foreign_keys = ON
    `);

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
            payment_transaction_id TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

});


/* =========================================================
   DATABASE HELPERS
========================================================= */

function dbGet(sql, params = []) {

    return new Promise(
        (resolve, reject) => {

            db.get(
                sql,
                params,
                (error, row) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(row);

                }
            );

        }
    );

}


function dbAll(sql, params = []) {

    return new Promise(
        (resolve, reject) => {

            db.all(
                sql,
                params,
                (error, rows) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(rows || []);

                }
            );

        }
    );

}


function dbRun(sql, params = []) {

    return new Promise(
        (resolve, reject) => {

            db.run(
                sql,
                params,
                function(error) {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        id: this.lastID,
                        changes: this.changes
                    });

                }
            );

        }
    );

}


/* =========================================================
   STARTER COUNTRIES
========================================================= */

const starterCountries = [

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
    ["Bhutan", "BT"],
    ["Bolivia", "BO"],
    ["Bosnia and Herzegovina", "BA"],
    ["Botswana", "BW"],
    ["Brazil", "BR"],
    ["Brunei", "BN"],
    ["Bulgaria", "BG"],
    ["Burkina Faso", "BF"],
    ["Burundi", "BI"],

    ["Cambodia", "KH"],
    ["Cameroon", "CM"],
    ["Canada", "CA"],
    ["Cape Verde", "CV"],
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

    ["Denmark", "DK"],
    ["Djibouti", "DJ"],
    ["Dominica", "DM"],
    ["Dominican Republic", "DO"],

    ["Ecuador", "EC"],
    ["Egypt", "EG"],
    ["El Salvador", "SV"],
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
    ["Mauritania", "MR"],
    ["Mauritius", "MU"],
    ["Mexico", "MX"],
    ["Moldova", "MD"],
    ["Monaco", "MC"],
    ["Mongolia", "MN"],
    ["Montenegro", "ME"],
    ["Morocco", "MA"],
    ["Mozambique", "MZ"],

    ["Namibia", "NA"],
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

    ["Saudi Arabia", "SA"],
    ["Senegal", "SN"],
    ["Serbia", "RS"],
    ["Seychelles", "SC"],
    ["Sierra Leone", "SL"],
    ["Singapore", "SG"],
    ["Slovakia", "SK"],
    ["Slovenia", "SI"],
    ["Somalia", "SO"],
    ["South Africa", "ZA"],
    ["South Korea", "KR"],
    ["Spain", "ES"],
    ["Sri Lanka", "LK"],
    ["Sudan", "SD"],
    ["Suriname", "SR"],
    ["Sweden", "SE"],
    ["Switzerland", "CH"],
    ["Syria", "SY"],

    ["Tajikistan", "TJ"],
    ["Tanzania", "TZ"],
    ["Thailand", "TH"],
    ["Timor-Leste", "TL"],
    ["Togo", "TG"],
    ["Trinidad and Tobago", "TT"],
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
    ["Zimbabwe", "ZW"]

];


async function seedCountries() {

    for (
        const [name, code]
        of starterCountries
    ) {

        await dbRun(
            `
            INSERT OR IGNORE INTO countries
            (name, code)
            VALUES (?, ?)
            `,
            [name, code]
        );

    }

}


async function seedBrands() {

    const starterBrands = [

        [
            "Apple",
            "United States",
            "Technology",
            "Apple Inc."
        ],

        [
            "Nike",
            "United States",
            "Sportswear",
            "Nike, Inc."
        ],

        [
            "Burberry",
            "United Kingdom",
            "Fashion",
            "British luxury fashion brand"
        ],

        [
            "BMW",
            "Germany",
            "Automotive",
            "German automotive manufacturer"
        ],

        [
            "L'Oréal",
            "France",
            "Beauty",
            "French beauty company"
        ],

        [
            "Ferrari",
            "Italy",
            "Automotive",
            "Italian automotive brand"
        ],

        [
            "Arçelik",
            "Türkiye",
            "Home Appliances",
            "Turkish home appliance company"
        ],

        [
            "Artel",
            "Uzbekistan",
            "Electronics",
            "Uzbekistan electronics brand"
        ],

        [
            "Toyota",
            "Japan",
            "Automotive",
            "Japanese automotive manufacturer"
        ],

        [
            "Samsung",
            "South Korea",
            "Electronics",
            "South Korean technology company"
        ],

        [
            "Huawei",
            "China",
            "Technology",
            "Chinese technology company"
        ],

        [
            "Tata",
            "India",
            "Conglomerate",
            "Indian business group"
        ]

    ];


    for (
        const [
            brandName,
            countryName,
            category,
            description
        ]
        of starterBrands
    ) {

        const country =
            await dbGet(
                `
                SELECT id
                FROM countries
                WHERE name = ?
                `,
                [countryName]
            );

        if (!country) {
            continue;
        }


        const existing =
            await dbGet(
                `
                SELECT id
                FROM brands
                WHERE name = ?
                AND country_id = ?
                `,
                [
                    brandName,
                    country.id
                ]
            );


        if (!existing) {

            await dbRun(
                `
                INSERT INTO brands
                (
                    country_id,
                    name,
                    category,
                    description,
                    verification
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    country.id,
                    brandName,
                    category,
                    description,
                    "Verified"
                ]
            );

        }

    }

}


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            ok: true,
            service: "ALL WORLD BRANDS",
            payment: "OCTO",
            octo_test: OCTO_TEST
        });

    }
);


/* =========================================================
   COUNTRIES API
========================================================= */

app.get(
    "/api/countries",
    async (req, res) => {

        try {

            const countries =
                await dbAll(
                    `
                    SELECT
                        id,
                        name,
                        code
                    FROM countries
                    ORDER BY name COLLATE NOCASE
                    `
                );

            res.json(countries);

        } catch (error) {

            console.error(
                "COUNTRIES ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load countries"
            });

        }

    }
);


/* =========================================================
   COUNTRY BRANDS
========================================================= */

app.get(
    "/api/countries/:id/brands",
    async (req, res) => {

        try {

            const countryId =
                Number(req.params.id);

            if (!Number.isInteger(countryId)) {

                return res.status(400).json({
                    error:
                        "Invalid country ID"
                });

            }


            const brands =
                await dbAll(
                    `
                    SELECT
                        id,
                        name,
                        logo,
                        category,
                        description,
                        website,
                        verification,
                        created_at
                    FROM brands
                    WHERE country_id = ?
                    ORDER BY name COLLATE NOCASE
                    `,
                    [countryId]
                );


            res.json(brands);

        } catch (error) {

            console.error(
                "COUNTRY BRANDS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load brands"
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

            const brandId =
                Number(req.params.id);

            if (!Number.isInteger(brandId)) {

                return res.status(400).json({
                    error:
                        "Invalid brand ID"
                });

            }


            const brand =
                await dbGet(
                    `
                    SELECT
                        brands.*,
                        countries.name AS country,
                        countries.code AS country_code
                    FROM brands
                    JOIN countries
                    ON countries.id =
                       brands.country_id
                    WHERE brands.id = ?
                    `,
                    [brandId]
                );


            if (!brand) {

                return res.status(404).json({
                    error:
                        "Brand not found"
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
                    [brandId]
                );


            res.json({
                ...brand,
                factories
            });

        } catch (error) {

            console.error(
                "BRAND ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to load brand"
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
                String(
                    req.query.q || ""
                ).trim();


            if (!q) {

                return res.json([]);

            }


            const like =
                `%${q}%`;


            const results =
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
                        countries.id AS country_id,
                        countries.name AS country,
                        countries.code AS country_code
                    FROM brands
                    JOIN countries
                    ON countries.id =
                       brands.country_id
                    WHERE
                        brands.name LIKE ?
                        OR brands.category LIKE ?
                        OR brands.description LIKE ?
                        OR countries.name LIKE ?
                    ORDER BY
                        brands.name COLLATE NOCASE
                    LIMIT 100
                    `,
                    [
                        like,
                        like,
                        like,
                        like
                    ]
                );


            res.json(results);

        } catch (error) {

            console.error(
                "SEARCH ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Search failed"
            });

        }

    }
);


/* =========================================================
   OCTO CREATE PAYMENT
========================================================= */

app.post(
    "/api/payments/octo/create",
    async (req, res) => {

        try {

            if (!OCTO_SECRET) {

                return res.status(500).json({
                    error:
                        "OCTO_SECRET is not configured"
                });

            }


            const transactionId =
                crypto.randomUUID();


            const initTime =
                new Date()
                    .toISOString()
                    .replace("T", " ")
                    .replace(/\.\d{3}Z$/, "");


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

                init_time:
                    initTime,

                total_sum:
                    PAYMENT_AMOUNT,

                currency:
                    PAYMENT_CURRENCY,

                description:
                    "ALL WORLD BRANDS PAYMENT",

                basket: [
                    {
                        position_desc:
                            "ALL WORLD BRANDS",

                        count: 1,

                        price:
                            PAYMENT_AMOUNT
                    }
                ],

                payment_methods: [
                    {
                        method:
                            "bank_card"
                    },
                    {
                        method:
                            "uzcard"
                    },
                    {
                        method:
                            "humo"
                    }
                ],

                return_url:
                    `${PUBLIC_BASE_URL}/payment-success.html?transaction=${encodeURIComponent(transactionId)}`,

                notify_url:
                    `${PUBLIC_BASE_URL}/api/octo/notify`,

                language:
                    "uz",

                ttl:
                    15

            };


            console.log(
                "OCTO CREATE:",
                {
                    transactionId,
                    amount:
                        PAYMENT_AMOUNT,
                    currency:
                        PAYMENT_CURRENCY,
                    test:
                        OCTO_TEST
                }
            );


            const response =
                await fetch(
                    OCTO_API_URL,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload)
                    }
                );


            const data =
                await response.json();


            console.log(
                "OCTO CREATE RESPONSE:",
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );


            if (!response.ok) {

                return res.status(502).json({
                    error:
                        "OCTO server error"
                });

            }


            if (
                data.error !== undefined &&
                Number(data.error) !== 0
            ) {

                return res.status(400).json({

                    error:
                        data.errMessage ||
                        data.errorMessage ||
                        "OCTO payment creation failed"

                });

            }


            const paymentUrl =
                data?.data?.octo_pay_url ||
                data?.octo_pay_url ||
                data?.data?.payment_url ||
                data?.payment_url;


            if (!paymentUrl) {

                return res.status(502).json({

                    error:
                        "OCTO payment URL was not returned"

                });

            }


            res.json({

                ok: true,

                transaction_id:
                    transactionId,

                amount:
                    PAYMENT_AMOUNT,

                currency:
                    PAYMENT_CURRENCY,

                payment_url:
                    paymentUrl

            });


        } catch (error) {

            console.error(
                "OCTO CREATE ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to create OCTO payment"

            });

        }

    }
);


/* =========================================================
   OCTO STATUS
========================================================= */

app.get(
    "/api/payments/octo/status/:transactionId",
    async (req, res) => {

        try {

            if (!OCTO_SECRET) {

                return res.status(500).json({
                    error:
                        "OCTO_SECRET is not configured"
                });

            }


            const transactionId =
                String(
                    req.params.transactionId || ""
                ).trim();


            if (!transactionId) {

                return res.status(400).json({
                    error:
                        "Transaction ID is required"
                });

            }


            const response =
                await fetch(
                    OCTO_API_URL,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                octo_shop_id:
                                    OCTO_SHOP_ID,

                                octo_secret:
                                    OCTO_SECRET,

                                shop_transaction_id:
                                    transactionId

                            })
                    }
                );


            const data =
                await response.json();


            res.json(data);

        } catch (error) {

            console.error(
                "OCTO STATUS ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "Unable to check payment status"

            });

        }

    }
);


/* =========================================================
   OCTO NOTIFICATION
========================================================= */

app.post(
    "/api/octo/notify",
    async (req, res) => {

        try {

            console.log(
                "OCTO NOTIFICATION:",
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );


            const transactionId =
                String(
                    req.body?.shop_transaction_id ||
                    ""
                ).trim();


            if (!transactionId) {

                return res.status(400).json({
                    error:
                        1,
                    errMessage:
                        "shop_transaction_id is required"
                });

            }


            /*
             * Never trust only the callback.
             * Ask OCTO directly for the real status.
             */

            const response =
                await fetch(
                    OCTO_API_URL,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                octo_shop_id:
                                    OCTO_SHOP_ID,

                                octo_secret:
                                    OCTO_SECRET,

                                shop_transaction_id:
                                    transactionId

                            })
                    }
                );


            const data =
                await response.json();


            console.log(
                "OCTO VERIFIED STATUS:",
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );


            if (
                data.error !== 0
            ) {

                return res.status(400).json({
                    error:
                        1,
                    errMessage:
                        "Unable to verify transaction"
                });

            }


            const status =
                data?.data?.status;


            /*
             * Payment is accepted only when
             * OCTO confirms "succeeded".
             */

            if (status !== "succeeded") {

                return res.status(400).json({

                    error:
                        1,

                    errMessage:
                        `Payment status is ${status || "unknown"}`

                });

            }


            /*
             * At this point OCTO itself confirms
             * the transaction as succeeded.
             */

            console.log(
                "OCTO PAYMENT SUCCEEDED:",
                transactionId
            );


            return res.json({
                error: 0
            });


        } catch (error) {

            console.error(
                "OCTO NOTIFY ERROR:",
                error
            );

            return res.status(500).json({

                error:
                    1,

                errMessage:
                    "Notification processing failed"

            });

        }

    }
);


/* =========================================================
   PAYMENT SUCCESS PAGE
========================================================= */

app.get(
    "/payment-success.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "payment-success.html"
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

Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml
`
        );

    }
);


/* =========================================================
   SITEMAP
========================================================= */

app.get(
    "/sitemap.xml",
    async (req, res) => {

        try {

            const countries =
                await dbAll(
                    `
                    SELECT id
                    FROM countries
                    ORDER BY id
                    `
                );


            const brands =
                await dbAll(
                    `
                    SELECT id
                    FROM brands
                    ORDER BY id
                    `
                );


            const urls = [

                `${PUBLIC_BASE_URL}/`

            ];


            /*
             * Country API URLs are not submitted as
             * SEO pages. The main page remains canonical.
             */

            for (
                const brand of brands
            ) {

                urls.push(
                    `${PUBLIC_BASE_URL}/?brand=${brand.id}`
                );

            }


            const uniqueUrls =
                [
                    ...new Set(urls)
                ];


            const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls.map(
    url => `
    <url>
        <loc>${escapeXml(url)}</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>`
).join("")}
</urlset>`;


            res
                .type("application/xml")
                .send(xml);


        } catch (error) {

            console.error(
                "SITEMAP ERROR:",
                error
            );

            res.status(500).send(
                "Unable to generate sitemap"
            );

        }

    }
);


function escapeXml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}


/* =========================================================
   MAIN PAGE
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
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        res.status(500).json({
            error:
                "Internal server error"
        });

    }
);


/* =========================================================
   START
========================================================= */

async function startServer() {

    try {

        await seedCountries();

        await seedBrands();


        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `ALL WORLD BRANDS running on port ${PORT}`
                );

                console.log(
                    `Database: ${DB_FILE}`
                );

                console.log(
                    `OCTO TEST: ${OCTO_TEST}`
                );

            }
        );

    } catch (error) {

        console.error(
            "STARTUP ERROR:",
            error
        );

        process.exit(1);

    }

}


startServer();
