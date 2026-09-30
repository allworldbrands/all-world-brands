"use strict";

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;

const SITE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const ADMIN_USER =
    process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "";


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


/* =========================================================
   DATABASE
========================================================= */

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "database.sqlite");

const db =
    new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");


/* =========================================================
   TABLES
========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        flag TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        country_id INTEGER NOT NULL,

        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        website TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',

        status TEXT DEFAULT 'approved',

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(country_id)
            REFERENCES countries(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        country_id INTEGER,

        brand_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        website TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',

        contact_name TEXT DEFAULT '',
        contact_email TEXT DEFAULT '',
        contact_phone TEXT DEFAULT '',

        price REAL DEFAULT 1,
        currency TEXT DEFAULT 'USD',

        payment_status TEXT DEFAULT 'unpaid',

        status TEXT DEFAULT 'pending',

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(country_id)
            REFERENCES countries(id)
            ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        comment TEXT NOT NULL,

        status TEXT DEFAULT 'pending',

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);


/* =========================================================
   COUNTRY DATA
========================================================= */

const countries = [
    ["Uzbekistan", "UZ", "🇺🇿"],
    ["United Kingdom", "GB", "🇬🇧"],
    ["United States", "US", "🇺🇸"],
    ["Germany", "DE", "🇩🇪"],
    ["France", "FR", "🇫🇷"],
    ["Italy", "IT", "🇮🇹"],
    ["Spain", "ES", "🇪🇸"],
    ["Turkey", "TR", "🇹🇷"],
    ["Switzerland", "CH", "🇨🇭"],
    ["Norway", "NO", "🇳🇴"],
    ["Sweden", "SE", "🇸🇪"],
    ["Denmark", "DK", "🇩🇰"],
    ["Finland", "FI", "🇫🇮"],
    ["Netherlands", "NL", "🇳🇱"],
    ["Belgium", "BE", "🇧🇪"],
    ["Austria", "AT", "🇦🇹"],
    ["Poland", "PL", "🇵🇱"],
    ["Czech Republic", "CZ", "🇨🇿"],
    ["Portugal", "PT", "🇵🇹"],
    ["Greece", "GR", "🇬🇷"],
    ["Ireland", "IE", "🇮🇪"],
    ["Iceland", "IS", "🇮🇸"],
    ["Canada", "CA", "🇨🇦"],
    ["Mexico", "MX", "🇲🇽"],
    ["Brazil", "BR", "🇧🇷"],
    ["Argentina", "AR", "🇦🇷"],
    ["Chile", "CL", "🇨🇱"],
    ["Australia", "AU", "🇦🇺"],
    ["New Zealand", "NZ", "🇳🇿"],
    ["Japan", "JP", "🇯🇵"],
    ["South Korea", "KR", "🇰🇷"],
    ["China", "CN", "🇨🇳"],
    ["India", "IN", "🇮🇳"],
    ["Singapore", "SG", "🇸🇬"],
    ["Malaysia", "MY", "🇲🇾"],
    ["Thailand", "TH", "🇹🇭"],
    ["Vietnam", "VN", "🇻🇳"],
    ["Indonesia", "ID", "🇮🇩"],
    ["Philippines", "PH", "🇵🇭"],
    ["United Arab Emirates", "AE", "🇦🇪"],
    ["Qatar", "QA", "🇶🇦"],
    ["Saudi Arabia", "SA", "🇸🇦"],
    ["Kuwait", "KW", "🇰🇼"],
    ["Oman", "OM", "🇴🇲"],
    ["South Africa", "ZA", "🇿🇦"],
    ["Egypt", "EG", "🇪🇬"],
    ["Morocco", "MA", "🇲🇦"],
    ["Nigeria", "NG", "🇳🇬"],
    ["Kenya", "KE", "🇰🇪"],
    ["Pakistan", "PK", "🇵🇰"]
];

const insertCountry =
    db.prepare(`
        INSERT OR IGNORE INTO countries
        (name, code, flag)
        VALUES (?, ?, ?)
    `);

const seedCountries =
    db.transaction(() => {

        for (const country of countries) {
            insertCountry.run(
                country[0],
                country[1],
                country[2]
            );
        }

    });

seedCountries();


/* =========================================================
   STARTER BRANDS
========================================================= */

const starterBrands = [
    ["Apple", "US", "Technology"],
    ["Nike", "US", "Sportswear"],
    ["Microsoft", "US", "Technology"],

    ["Burberry", "GB", "Fashion"],

    ["BMW", "DE", "Automotive"],

    ["L'Oréal", "FR", "Beauty"],

    ["Ferrari", "IT", "Automotive"],

    ["Arçelik", "TR", "Home Appliances"],

    ["Artel", "UZ", "Electronics"],

    ["Toyota", "JP", "Automotive"],

    ["Samsung", "KR", "Electronics"],

    ["Huawei", "CN", "Technology"],

    ["Tata", "IN", "Industrial"]
];

const findCountry =
    db.prepare(`
        SELECT id
        FROM countries
        WHERE code = ?
    `);

const insertBrand =
    db.prepare(`
        INSERT INTO brands
        (
            country_id,
            name,
            description,
            status
        )
        VALUES (?, ?, ?, 'approved')
    `);

const seedBrands =
    db.transaction(() => {

        for (const brand of starterBrands) {

            const country =
                findCountry.get(
                    brand[1]
                );

            if (!country) {
                continue;
            }

            const exists =
                db.prepare(`
                    SELECT id
                    FROM brands
                    WHERE country_id = ?
                    AND LOWER(name) = LOWER(?)
                    LIMIT 1
                `).get(
                    country.id,
                    brand[0]
                );

            if (!exists) {

                insertBrand.run(
                    country.id,
                    brand[0],
                    brand[2]
                );

            }

        }

    });

seedBrands();


/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value, max = 2000) {

    return String(value ?? "")
        .trim()
        .slice(0, max);
}


function normalizeEmail(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase()
        .slice(0, 254);
}


function isValidEmail(email) {

    if (!email) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


function isSafeUrl(value) {

    if (!value) {
        return true;
    }

    const url =
        String(value).trim();

    if (url.length > 2048) {
        return false;
    }

    try {

        const parsed =
            new URL(url);

        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        );

    } catch (_) {

        return false;

    }

}


/* =========================================================
   BASIC AUTH
========================================================= */

function adminAuth(req, res, next) {

    if (!ADMIN_PASSWORD) {

        return res.status(503).json({
            error:
                "Admin password is not configured."
        });

    }

    const header =
        req.headers.authorization;

    if (!header ||
        !header.startsWith("Basic ")) {

        res.set(
            "WWW-Authenticate",
            'Basic realm="ALL WORLD BRANDS ADMIN"'
        );

        return res.status(401).json({
            error: "Authentication required."
        });

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

    } catch (_) {

        return res.status(401).json({
            error: "Invalid authentication."
        });

    }

    const separator =
        decoded.indexOf(":");

    if (separator === -1) {

        return res.status(401).json({
            error: "Invalid authentication."
        });

    }

    const username =
        decoded.slice(0, separator);

    const password =
        decoded.slice(separator + 1);

    if (
        username !== ADMIN_USER ||
        password !== ADMIN_PASSWORD
    ) {

        return res.status(401).json({
            error: "Invalid credentials."
        });

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
            site: "ALL WORLD BRANDS",
            version: "2026",
            payment: {
                octo: false,
                brand_submission_price: 1,
                currency: "USD"
            }
        });

    }
);


/* =========================================================
   SITE INFO
========================================================= */

app.get(
    "/api/info",
    (req, res) => {

        res.json({

            site_name:
                "ALL WORLD BRANDS",

            phone:
                "+998933843112",

            whatsapp:
                "+998933843112",

            email:
                "allworldbrandsnet@gmail.com",

            payment_logos: [
                "Mastercard",
                "Visa",
                "PayPal"
            ],

            brand_submission: {
                price: 1,
                currency: "USD"
            }

        });

    }
);


/* =========================================================
   COUNTRIES
========================================================= */

app.get(
    "/api/countries",
    (req, res) => {

        const rows =
            db.prepare(`
                SELECT
                    id,
                    name,
                    code,
                    flag
                FROM countries
                ORDER BY name COLLATE NOCASE ASC
            `).all();

        res.json(rows);

    }
);


/* =========================================================
   COUNTRY BRANDS
========================================================= */

app.get(
    "/api/countries/:id/brands",
    (req, res) => {

        const id =
            Number(req.params.id);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                error: "Invalid country ID."
            });

        }

        const brands =
            db.prepare(`
                SELECT
                    id,
                    country_id,
                    name,
                    description,
                    website,
                    logo_url,
                    status,
                    created_at
                FROM brands
                WHERE country_id = ?
                AND status = 'approved'
                ORDER BY name COLLATE NOCASE ASC
            `).all(id);

        res.json(brands);

    }
);


/* =========================================================
   BRAND
========================================================= */

app.get(
    "/api/brands/:id",
    (req, res) => {

        const id =
            Number(req.params.id);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                error: "Invalid brand ID."
            });

        }

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
                AND b.status = 'approved'
                LIMIT 1
            `).get(id);

        if (!brand) {

            return res.status(404).json({
                error: "Brand not found."
            });

        }

        res.json(brand);

    }
);


/* =========================================================
   SEARCH
========================================================= */

app.get(
    "/api/search",
    (req, res) => {

        const q =
            normalizeText(
                req.query.q,
                100
            );

        if (!q) {

            return res.json([]);

        }

        const search =
            `%${q}%`;

        const results =
            db.prepare(`
                SELECT
                    b.id,
                    b.name,
                    b.description,
                    b.website,
                    c.id AS country_id,
                    c.name AS country_name,
                    c.code AS country_code,
                    c.flag AS country_flag
                FROM brands b
                JOIN countries c
                    ON c.id = b.country_id
                WHERE b.status = 'approved'
                AND (
                    b.name LIKE ?
                    OR b.description LIKE ?
                    OR c.name LIKE ?
                    OR c.code LIKE ?
                )
                ORDER BY
                    b.name COLLATE NOCASE ASC
                LIMIT 100
            `).all(
                search,
                search,
                search,
                search
            );

        res.json(results);

    }
);


/* =========================================================
   BRAND SUBMISSION
   PRICE = $1
========================================================= */

app.post(
    "/api/applications",
    (req, res) => {

        const brandName =
            normalizeText(
                req.body.brand_name ||
                req.body.name,
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

        const logoUrl =
            normalizeText(
                req.body.logo_url,
                2048
            );

        const contactName =
            normalizeText(
                req.body.contact_name,
                150
            );

        const contactEmail =
            normalizeEmail(
                req.body.contact_email
            );

        const contactPhone =
            normalizeText(
                req.body.contact_phone,
                50
            );

        const countryId =
            Number(
                req.body.country_id
            );


        if (!brandName) {

            return res.status(400).json({
                error:
                    "Brand name is required."
            });

        }


        if (
            !Number.isInteger(countryId) ||
            countryId <= 0
        ) {

            return res.status(400).json({
                error:
                    "Valid country is required."
            });

        }


        const country =
            db.prepare(`
                SELECT id
                FROM countries
                WHERE id = ?
            `).get(countryId);

        if (!country) {

            return res.status(400).json({
                error:
                    "Country not found."
            });

        }


        if (
            contactEmail &&
            !isValidEmail(contactEmail)
        ) {

            return res.status(400).json({
                error:
                    "Invalid email address."
            });

        }


        if (
            website &&
            !isSafeUrl(website)
        ) {

            return res.status(400).json({
                error:
                    "Invalid website URL."
            });

        }


        if (
            logoUrl &&
            !isSafeUrl(logoUrl)
        ) {

            return res.status(400).json({
                error:
                    "Invalid logo URL."
            });

        }


        /*
         * Brand qo‘shish narxi:
         *
         * 1 USD
         *
         * Hozircha OCTO yo‘q.
         * Payment gateway keyin alohida ulanadi.
         */

        const price = 1;
        const currency = "USD";


        const result =
            db.prepare(`
                INSERT INTO applications
                (
                    country_id,
                    brand_name,
                    description,
                    website,
                    logo_url,
                    contact_name,
                    contact_email,
                    contact_phone,
                    price,
                    currency,
                    payment_status,
                    status
                )
                VALUES
                (
                    @country_id,
                    @brand_name,
                    @description,
                    @website,
                    @logo_url,
                    @contact_name,
                    @contact_email,
                    @contact_phone,
                    @price,
                    @currency,
                    'unpaid',
                    'pending'
                )
            `).run({

                country_id:
                    countryId,

                brand_name:
                    brandName,

                description:
                    description,

                website:
                    website,

                logo_url:
                    logoUrl,

                contact_name:
                    contactName,

                contact_email:
                    contactEmail,

                contact_phone:
                    contactPhone,

                price:
                    price,

                currency:
                    currency

            });


        res.status(201).json({

            success: true,

            application_id:
                result.lastInsertRowid,

            payment_required: true,

            amount: 1,

            currency: "USD",

            payment_status:
                "unpaid",

            message:
                "Brand application created. Payment of $1 is required before approval."

        });

    }
);


/* =========================================================
   COMMENTS
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
                    created_at
                FROM comments
                WHERE status = 'approved'
                ORDER BY created_at DESC
                LIMIT 100
            `).all();

        res.json(comments);

    }
);


/* =========================================================
   ADD COMMENT
========================================================= */

app.post(
    "/api/comments",
    (req, res) => {

        const name =
            normalizeText(
                req.body.name,
                100
            );

        const email =
            normalizeEmail(
                req.body.email
            );

        const comment =
            normalizeText(
                req.body.comment,
                2000
            );


        if (!name) {

            return res.status(400).json({
                error:
                    "Name is required."
            });

        }


        if (!comment) {

            return res.status(400).json({
                error:
                    "Comment is required."
            });

        }


        if (
            email &&
            !isValidEmail(email)
        ) {

            return res.status(400).json({
                error:
                    "Invalid email address."
            });

        }


        const result =
            db.prepare(`
                INSERT INTO comments
                (
                    name,
                    email,
                    comment,
                    status
                )
                VALUES
                (?, ?, ?, 'pending')
            `).run(
                name,
                email,
                comment
            );


        res.status(201).json({

            success: true,

            id:
                result.lastInsertRowid,

            message:
                "Comment submitted for review."

        });

    }
);


/* =========================================================
   ADMIN — APPLICATIONS
========================================================= */

app.get(
    "/api/admin/applications",
    adminAuth,
    (req, res) => {

        const rows =
            db.prepare(`
                SELECT
                    a.*,
                    c.name AS country_name,
                    c.code AS country_code
                FROM applications a
                LEFT JOIN countries c
                    ON c.id = a.country_id
                ORDER BY
                    a.created_at DESC
            `).all();

        res.json(rows);

    }
);


/* =========================================================
   ADMIN — COMMENTS
========================================================= */

app.get(
    "/api/admin/comments",
    adminAuth,
    (req, res) => {

        const rows =
            db.prepare(`
                SELECT *
                FROM comments
                ORDER BY created_at DESC
            `).all();

        res.json(rows);

    }
);


/* =========================================================
   ADMIN — APPROVE COMMENT
========================================================= */

app.patch(
    "/api/admin/comments/:id",
    adminAuth,
    (req, res) => {

        const id =
            Number(req.params.id);

        const status =
            normalizeText(
                req.body.status,
                20
            );

        if (
            !Number.isInteger(id) ||
            ![
                "approved",
                "pending",
                "rejected"
            ].includes(status)
        ) {

            return res.status(400).json({
                error:
                    "Invalid request."
            });

        }

        const result =
            db.prepare(`
                UPDATE comments
                SET status = ?
                WHERE id = ?
            `).run(
                status,
                id
            );

        res.json({
            success:
                result.changes > 0
        });

    }
);


/* =========================================================
   ADMIN — APPROVE BRAND APPLICATION
========================================================= */

app.post(
    "/api/admin/applications/:id/approve",
    adminAuth,
    (req, res) => {

        const id =
            Number(req.params.id);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                error:
                    "Invalid application ID."
            });

        }


        const application =
            db.prepare(`
                SELECT *
                FROM applications
                WHERE id = ?
                LIMIT 1
            `).get(id);


        if (!application) {

            return res.status(404).json({
                error:
                    "Application not found."
            });

        }


        /*
         * Hozirgi tizimda haqiqiy payment
         * provider ulanmagan.
         *
         * Shuning uchun admin faqat
         * payment_status = paid bo‘lsa
         * brandni tasdiqlashi kerak.
         */

        if (
            application.payment_status !==
            "paid"
        ) {

            return res.status(400).json({

                error:
                    "Payment is not confirmed."

            });

        }


        const insert =
            db.prepare(`
                INSERT INTO brands
                (
                    country_id,
                    name,
                    description,
                    website,
                    logo_url,
                    status
                )
                VALUES
                (?, ?, ?, ?, ?, 'approved')
            `);


        const update =
            db.prepare(`
                UPDATE applications
                SET status = 'approved'
                WHERE id = ?
            `);


        const transaction =
            db.transaction(() => {

                const result =
                    insert.run(
                        application.country_id,
                        application.brand_name,
                        application.description,
                        application.website,
                        application.logo_url
                    );

                update.run(id);

                return result;

            });


        const result =
            transaction();


        res.json({

            success: true,

            brand_id:
                result.lastInsertRowid

        });

    }
);


/* =========================================================
   ADMIN — CONFIRM PAYMENT
   Temporary/manual until real gateway is selected.
========================================================= */

app.post(
    "/api/admin/applications/:id/payment",
    adminAuth,
    (req, res) => {

        const id =
            Number(req.params.id);

        if (!Number.isInteger(id)) {

            return res.status(400).json({
                error:
                    "Invalid application ID."
            });

        }


        const result =
            db.prepare(`
                UPDATE applications
                SET
                    payment_status = 'paid'
                WHERE id = ?
            `).run(id);


        if (!result.changes) {

            return res.status(404).json({
                error:
                    "Application not found."
            });

        }


        res.json({

            success: true,

            payment_status:
                "paid"

        });

    }
);


/* =========================================================
   ADMIN — CREATE BRAND DIRECTLY
========================================================= */

app.post(
    "/api/admin/brands",
    adminAuth,
    (req, res) => {

        const countryId =
            Number(
                req.body.country_id
            );

        const name =
            normalizeText(
                req.body.name,
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

        const logoUrl =
            normalizeText(
                req.body.logo_url,
                2048
            );


        if (
            !Number.isInteger(countryId) ||
            !name
        ) {

            return res.status(400).json({
                error:
                    "Country and brand name are required."
            });

        }


        if (
            website &&
            !isSafeUrl(website)
        ) {

            return res.status(400).json({
                error:
                    "Invalid website URL."
            });

        }


        if (
            logoUrl &&
            !isSafeUrl(logoUrl)
        ) {

            return res.status(400).json({
                error:
                    "Invalid logo URL."
            });

        }


        const result =
            db.prepare(`
                INSERT INTO brands
                (
                    country_id,
                    name,
                    description,
                    website,
                    logo_url,
                    status
                )
                VALUES
                (?, ?, ?, ?, ?, 'approved')
            `).run(
                countryId,
                name,
                description,
                website,
                logoUrl
            );


        res.status(201).json({

            success: true,

            brand_id:
                result.lastInsertRowid

        });

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

Sitemap: ${SITE_URL}/sitemap.xml
`
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
            db.prepare(`
                SELECT id
                FROM countries
                ORDER BY id
            `).all();


        const brandRows =
            db.prepare(`
                SELECT id
                FROM brands
                WHERE status = 'approved'
                ORDER BY id
            `).all();


        const urls = [

            `${SITE_URL}/`

        ];


        for (const country of countryRows) {

            urls.push(
                `${SITE_URL}/country/${country.id}`
            );

        }


        for (const brand of brandRows) {

            urls.push(
                `${SITE_URL}/brand/${brand.id}`
            );

        }


        const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${urls.map(
    url =>
`    <url>
        <loc>${escapeXml(url)}</loc>
    </url>`
).join("\n")}
</urlset>`;


        res
            .type("application/xml")
            .send(xml);

    }
);


/* =========================================================
   XML ESCAPE
========================================================= */

function escapeXml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");

}


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
   404 API
========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            error:
                "API endpoint not found."
        });

    }
);


/* =========================================================
   GLOBAL ERROR HANDLER
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
                "Internal server error."
        });

    }
);


/* =========================================================
   START
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `ALL WORLD BRANDS running on port ${PORT}`
        );

        console.log(
            `Site: ${SITE_URL}`
        );

        console.log(
            "OCTO payment integration: REMOVED"
        );

        console.log(
            "Brand submission price: $1 USD"
        );

    }
);
