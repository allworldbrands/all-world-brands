const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const app = express();

const PORT = Number(process.env.PORT || 3000);

const PUBLIC_BASE_URL = String(
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net"
).replace(/\/+$/, "");

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

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================================
   DATABASE
========================================================= */

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
   249 ISO COUNTRY / TERRITORY LIST
========================================================= */

const starterCountries = [

    ["Afghanistan", "AF"],
    ["Albania", "AL"],
    ["Algeria", "DZ"],
    ["American Samoa", "AS"],
    ["Andorra", "AD"],
    ["Angola", "AO"],
    ["Anguilla", "AI"],
    ["Antarctica", "AQ"],
    ["Antigua and Barbuda", "AG"],
    ["Argentina", "AR"],
    ["Armenia", "AM"],
    ["Aruba", "AW"],
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
    ["Bermuda", "BM"],
    ["Bhutan", "BT"],
    ["Bolivia", "BO"],
    ["Bonaire, Sint Eustatius and Saba", "BQ"],
    ["Bosnia and Herzegovina", "BA"],
    ["Botswana", "BW"],
    ["Bouvet Island", "BV"],
    ["Brazil", "BR"],
    ["British Indian Ocean Territory", "IO"],
    ["Brunei", "BN"],
    ["Bulgaria", "BG"],
    ["Burkina Faso", "BF"],
    ["Burundi", "BI"],

    ["Cabo Verde", "CV"],
    ["Cambodia", "KH"],
    ["Cameroon", "CM"],
    ["Canada", "CA"],
    ["Cayman Islands", "KY"],
    ["Central African Republic", "CF"],
    ["Chad", "TD"],
    ["Chile", "CL"],
    ["China", "CN"],
    ["Christmas Island", "CX"],
    ["Cocos (Keeling) Islands", "CC"],
    ["Colombia", "CO"],
    ["Comoros", "KM"],
    ["Congo", "CG"],
    ["Cook Islands", "CK"],
    ["Costa Rica", "CR"],
    ["Croatia", "HR"],
    ["Cuba", "CU"],
    ["Curaçao", "CW"],
    ["Cyprus", "CY"],
    ["Czechia", "CZ"],
    ["Côte d'Ivoire", "CI"],

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

    ["Falkland Islands", "FK"],
    ["Faroe Islands", "FO"],
    ["Fiji", "FJ"],
    ["Finland", "FI"],
    ["France", "FR"],
    ["French Guiana", "GF"],
    ["French Polynesia", "PF"],
    ["French Southern Territories", "TF"],

    ["Gabon", "GA"],
    ["Gambia", "GM"],
    ["Georgia", "GE"],
    ["Germany", "DE"],
    ["Ghana", "GH"],
    ["Gibraltar", "GI"],
    ["Greece", "GR"],
    ["Greenland", "GL"],
    ["Grenada", "GD"],
    ["Guadeloupe", "GP"],
    ["Guam", "GU"],
    ["Guatemala", "GT"],
    ["Guernsey", "GG"],
    ["Guinea", "GN"],
    ["Guinea-Bissau", "GW"],
    ["Guyana", "GY"],

    ["Haiti", "HT"],
    ["Heard Island and McDonald Islands", "HM"],
    ["Honduras", "HN"],
    ["Hong Kong", "HK"],
    ["Hungary", "HU"],

    ["Iceland", "IS"],
    ["India", "IN"],
    ["Indonesia", "ID"],
    ["Iran", "IR"],
    ["Iraq", "IQ"],
    ["Ireland", "IE"],
    ["Isle of Man", "IM"],
    ["Israel", "IL"],
    ["Italy", "IT"],

    ["Jamaica", "JM"],
    ["Japan", "JP"],
    ["Jersey", "JE"],
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

    ["Macao", "MO"],
    ["Madagascar", "MG"],
    ["Malawi", "MW"],
    ["Malaysia", "MY"],
    ["Maldives", "MV"],
    ["Mali", "ML"],
    ["Malta", "MT"],
    ["Marshall Islands", "MH"],
    ["Martinique", "MQ"],
    ["Mauritania", "MR"],
    ["Mauritius", "MU"],
    ["Mayotte", "YT"],
    ["Mexico", "MX"],
    ["Micronesia", "FM"],
    ["Moldova", "MD"],
    ["Monaco", "MC"],
    ["Mongolia", "MN"],
    ["Montenegro", "ME"],
    ["Montserrat", "MS"],
    ["Morocco", "MA"],
    ["Mozambique", "MZ"],
    ["Myanmar", "MM"],

    ["Namibia", "NA"],
    ["Nauru", "NR"],
    ["Nepal", "NP"],
    ["Netherlands", "NL"],
    ["New Caledonia", "NC"],
    ["New Zealand", "NZ"],
    ["Nicaragua", "NI"],
    ["Niger", "NE"],
    ["Nigeria", "NG"],
    ["Niue", "NU"],
    ["Norfolk Island", "NF"],
    ["North Korea", "KP"],
    ["North Macedonia", "MK"],
    ["Northern Mariana Islands", "MP"],
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
    ["Pitcairn", "PN"],
    ["Poland", "PL"],
    ["Portugal", "PT"],
    ["Puerto Rico", "PR"],

    ["Qatar", "QA"],

    ["Romania", "RO"],
    ["Russia", "RU"],
    ["Rwanda", "RW"],
    ["Réunion", "RE"],

    ["Saint Barthélemy", "BL"],
    ["Saint Helena, Ascension and Tristan da Cunha", "SH"],
    ["Saint Kitts and Nevis", "KN"],
    ["Saint Lucia", "LC"],
    ["Saint Martin (French part)", "MF"],
    ["Saint Pierre and Miquelon", "PM"],
    ["Saint Vincent and the Grenadines", "VC"],
    ["Samoa", "WS"],
    ["San Marino", "SM"],
    ["Saudi Arabia", "SA"],
    ["Senegal", "SN"],
    ["Serbia", "RS"],
    ["Seychelles", "SC"],
    ["Sierra Leone", "SL"],
    ["Singapore", "SG"],
    ["Sint Maarten (Dutch part)", "SX"],
    ["Slovakia", "SK"],
    ["Slovenia", "SI"],
    ["Solomon Islands", "SB"],
    ["Somalia", "SO"],
    ["South Africa", "ZA"],
    ["South Georgia and the South Sandwich Islands", "GS"],
    ["South Korea", "KR"],
    ["South Sudan", "SS"],
    ["Spain", "ES"],
    ["Sri Lanka", "LK"],
    ["Sudan", "SD"],
    ["Suriname", "SR"],
    ["Svalbard and Jan Mayen", "SJ"],
    ["Sweden", "SE"],
    ["Switzerland", "CH"],
    ["Syria", "SY"],
    ["São Tomé and Príncipe", "ST"],

    ["Taiwan", "TW"],
    ["Tajikistan", "TJ"],
    ["Tanzania", "TZ"],
    ["Thailand", "TH"],
    ["Timor-Leste", "TL"],
    ["Togo", "TG"],
    ["Tokelau", "TK"],
    ["Tonga", "TO"],
    ["Trinidad and Tobago", "TT"],
    ["Tunisia", "TN"],
    ["Turkmenistan", "TM"],
    ["Turks and Caicos Islands", "TC"],
    ["Tuvalu", "TV"],
    ["Türkiye", "TR"],

    ["U.S. Minor Outlying Islands", "UM"],
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
    ["Virgin Islands, British", "VG"],
    ["Virgin Islands, U.S.", "VI"],

    ["Wallis and Futuna", "WF"],
    ["Western Sahara", "EH"],
    ["Yemen", "YE"],
    ["Zambia", "ZM"],
    ["Zimbabwe", "ZW"],
    ["Åland Islands", "AX"]

];


/* =========================================================
   SLUG
========================================================= */

function slugify(value) {

    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}


/* =========================================================
   HTML HELPERS
========================================================= */

function htmlEscape(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}


function escapeXml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}


function safeWebsite(value) {

    const text =
        String(value || "").trim();

    if (!text) {
        return "";
    }

    try {

        const url =
            new URL(
                /^https?:\/\//i.test(text)
                    ? text
                    : `https://${text}`
            );

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return "";
        }

        return url.href;

    } catch {

        return "";

    }

}


/* =========================================================
   SEED COUNTRIES
========================================================= */

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
            [
                name,
                code
            ]
        );

    }

}


/* =========================================================
   SEED BRANDS
========================================================= */

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
                [
                    countryName
                ]
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
            octo_test: OCTO_TEST,
            countries_target:
                starterCountries.length
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
   COUNTRY BRANDS API
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
                    [
                        countryId
                    ]
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
   BRAND DETAILS API
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
                    [
                        brandId
                    ]
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
                    [
                        brandId
                    ]
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
   SEARCH API
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
   SEO COUNTRY PAGE
========================================================= */

app.get(
    "/country/:slug",
    async (req, res) => {

        try {

            const slug =
                String(
                    req.params.slug || ""
                ).trim();

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

            const country =
                countries.find(
                    item =>
                        slugify(item.name) ===
                        slug
                );

            if (!country) {

                return res.status(404).send(
                    "Country not found"
                );

            }

            const brands =
                await dbAll(
                    `
                    SELECT
                        id,
                        name,
                        category,
                        description,
                        website,
                        verification
                    FROM brands
                    WHERE country_id = ?
                    ORDER BY name COLLATE NOCASE
                    `,
                    [
                        country.id
                    ]
                );

            const canonical =
                `${PUBLIC_BASE_URL}/country/${slugify(country.name)}`;

            const brandHtml =
                brands.length
                    ? brands.map(
                        brand => {

                            const brandUrl =
                                `${PUBLIC_BASE_URL}/brand/${brand.id}`;

                            return `
<article class="brand">
    <h2>
        <a href="${htmlEscape(brandUrl)}">
            ${htmlEscape(brand.name)}
        </a>
    </h2>

    ${
        brand.category
            ? `
                <p>
                    <strong>Category:</strong>
                    ${htmlEscape(brand.category)}
                </p>
            `
            : ""
    }

    ${
        brand.description
            ? `
                <p>
                    ${htmlEscape(brand.description)}
                </p>
            `
            : ""
    }
</article>
`;

                        }
                    ).join("")
                    : `
<p>
    No brands have been added for
    ${htmlEscape(country.name)} yet.
</p>
`;

            const otherCountries =
                countries
                    .filter(
                        item =>
                            item.id !== country.id
                    )
                    .slice(0, 24)
                    .map(
                        item => `
<li>
    <a href="/country/${htmlEscape(
        slugify(item.name)
    )}">
        ${htmlEscape(item.name)}
    </a>
</li>
`
                    )
                    .join("");

            const jsonLd =
                JSON.stringify({
                    "@context":
                        "https://schema.org",
                    "@type":
                        "WebPage",
                    "name":
                        `${country.name} Brands | ALL WORLD BRANDS`,
                    "url":
                        canonical,
                    "description":
                        `Discover brands from ${country.name} on ALL WORLD BRANDS.`,
                    "breadcrumb": {
                        "@type":
                            "BreadcrumbList",
                        "itemListElement": [
                            {
                                "@type":
                                    "ListItem",
                                "position": 1,
                                "name":
                                    "ALL WORLD BRANDS",
                                "item":
                                    PUBLIC_BASE_URL
                            },
                            {
                                "@type":
                                    "ListItem",
                                "position": 2,
                                "name":
                                    country.name,
                                "item":
                                    canonical
                            }
                        ]
                    }
                });

            res
                .type("html")
                .send(
`<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
${htmlEscape(country.name)}
Brands | ALL WORLD BRANDS
</title>

<meta
    name="description"
    content="Discover brands from ${htmlEscape(country.name)} on ALL WORLD BRANDS."
>

<link
    rel="canonical"
    href="${htmlEscape(canonical)}"
>

<script type="application/ld+json">
${jsonLd}
</script>

<style>

body{
    margin:0;
    font-family:Arial,sans-serif;
    background:#050914;
    color:#fff;
    line-height:1.6;
}

main{
    max-width:1000px;
    margin:0 auto;
    padding:40px 20px;
}

a{
    color:#70d7ff;
}

.card{
    background:#101827;
    border:1px solid #26344a;
    border-radius:18px;
    padding:22px;
    margin:15px 0;
}

.brand{
    background:#0c1422;
    border:1px solid #223047;
    border-radius:14px;
    padding:18px;
    margin:14px 0;
}

ul{
    padding-left:22px;
}

.small{
    color:#aab6c7;
}

</style>

</head>

<body>

<main>

<header>

<p>
<a href="/">
← ALL WORLD BRANDS
</a>
</p>

<h1>
${htmlEscape(country.name)}
</h1>

<p class="small">
Country code:
${htmlEscape(country.code)}
·
Brands listed:
${brands.length}
</p>

</header>

<section class="card">

<h2>
Brands from
${htmlEscape(country.name)}
</h2>

${brandHtml}

</section>

<section class="card">

<h2>
Explore other countries
</h2>

<ul>
${otherCountries}
</ul>

</section>

</main>

</body>
</html>`
                );

        } catch (error) {

            console.error(
                "COUNTRY PAGE ERROR:",
                error
            );

            res.status(500).send(
                "Unable to load country page"
            );

        }

    }
);


/* =========================================================
   SEO BRAND PAGE
========================================================= */

app.get(
    "/brand/:id",
    async (req, res) => {

        try {

            const brandId =
                Number(req.params.id);

            if (!Number.isInteger(brandId)) {

                return res.status(404).send(
                    "Brand not found"
                );

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
                    [
                        brandId
                    ]
                );

            if (!brand) {

                return res.status(404).send(
                    "Brand not found"
                );

            }

            const factories =
                await dbAll(
                    `
                    SELECT *
                    FROM factories
                    WHERE brand_id = ?
                    ORDER BY name COLLATE NOCASE
                    `,
                    [
                        brandId
                    ]
                );

            const canonical =
                `${PUBLIC_BASE_URL}/brand/${brand.id}`;

            const website =
                safeWebsite(
                    brand.website
                );

            const jsonLd =
                JSON.stringify({
                    "@context":
                        "https://schema.org",
                    "@type":
                        "Organization",
                    "name":
                        brand.name,
                    "description":
                        brand.description || "",
                    "url":
                        canonical
                });

            const factoryHtml =
                factories.length
                    ? `
<h2>Factories</h2>

${factories.map(
    factory => `
<div class="factory">

<h3>
${htmlEscape(
    factory.name ||
    "Factory"
)}
</h3>

${
    factory.city
        ? `
<p>
${htmlEscape(factory.city)}
</p>
`
        : ""
}

${
    factory.address
        ? `
<p>
${htmlEscape(factory.address)}
</p>
`
        : ""
}

</div>
`
).join("")}
`
                    : "";

            res
                .type("html")
                .send(
`<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
${htmlEscape(brand.name)}
|
ALL WORLD BRANDS
</title>

<meta
    name="description"
    content="${htmlEscape(
        brand.description ||
        `${brand.name} brand from ${brand.country}`
    )}"
>

<link
    rel="canonical"
    href="${htmlEscape(canonical)}"
>

<script type="application/ld+json">
${jsonLd}
</script>

<style>

body{
    margin:0;
    font-family:Arial,sans-serif;
    background:#050914;
    color:#fff;
    line-height:1.6;
}

main{
    max-width:900px;
    margin:0 auto;
    padding:40px 20px;
}

a{
    color:#70d7ff;
}

.card{
    background:#101827;
    border:1px solid #26344a;
    border-radius:18px;
    padding:25px;
}

.factory{
    border-top:1px solid #26344a;
    padding:12px 0;
}

.small{
    color:#aab6c7;
}

</style>

</head>

<body>

<main>

<p>
<a href="/">
← ALL WORLD BRANDS
</a>
</p>

<div class="card">

<h1>
${htmlEscape(brand.name)}
</h1>

<p class="small">

Country:

<a href="/country/${htmlEscape(
    slugify(brand.country)
)}">

${htmlEscape(brand.country)}

</a>

</p>

${
    brand.category
        ? `
<p>
<strong>Category:</strong>
${htmlEscape(brand.category)}
</p>
`
        : ""
}

${
    brand.description
        ? `
<p>
${htmlEscape(brand.description)}
</p>
`
        : ""
}

${
    website
        ? `
<p>
<a
    href="${htmlEscape(website)}"
    rel="noopener noreferrer"
>
Official website
</a>
</p>
`
        : ""
}

${factoryHtml}

</div>

</main>

</body>

</html>`
                );

        } catch (error) {

            console.error(
                "BRAND PAGE ERROR:",
                error
            );

            res.status(500).send(
                "Unable to load brand page"
            );

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

                        count:
                            1,

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
                    `${PUBLIC_BASE_URL}/payment-success.html?transaction=${encodeURIComponent(
                        transactionId
                    )}`,

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
                            JSON.stringify(
                                payload
                            )
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

                ok:
                    true,

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

            if (!OCTO_SECRET) {

                return res.status(500).json({
                    error:
                        1,
                    errMessage:
                        "OCTO_SECRET is not configured"
                });

            }

            /*
             * Do not trust only the callback.
             * Verify transaction directly with OCTO.
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
                Number(data.error) !== 0
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

            if (
                status !== "succeeded"
            ) {

                return res.status(400).json({

                    error:
                        1,

                    errMessage:
                        `Payment status is ${
                            status || "unknown"
                        }`

                });

            }

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
   ROBOTS.TXT
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
   SITEMAP.XML
========================================================= */

app.get(
    "/sitemap.xml",
    async (req, res) => {

        try {

            const countries =
                await dbAll(
                    `
                    SELECT
                        id,
                        name
                    FROM countries
                    ORDER BY name COLLATE NOCASE
                    `
                );

            const brands =
                await dbAll(
                    `
                    SELECT
                        id
                    FROM brands
                    ORDER BY id
                    `
                );

            const urls = [

                `${PUBLIC_BASE_URL}/`

            ];

            /*
             * Add every country SEO page.
             */

            for (
                const country of countries
            ) {

                urls.push(
                    `${PUBLIC_BASE_URL}/country/${slugify(
                        country.name
                    )}`
                );

            }

            /*
             * Add every brand SEO page.
             */

            for (
                const brand of brands
            ) {

                urls.push(
                    `${PUBLIC_BASE_URL}/brand/${brand.id}`
                );

            }

            const uniqueUrls =
                [
                    ...new Set(urls)
                ];

            const xml =
`<?xml version="1.0" encoding="UTF-8"?>

<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>

${uniqueUrls.map(
    url => `
    <url>
        <loc>${escapeXml(url)}</loc>
    </url>
`
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
   START SERVER
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
                    `Countries in seed: ${
                        starterCountries.length
                    }`
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
