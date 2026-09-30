"use strict";

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "database.db");

const SITE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public"), {
    extensions: ["html"]
}));

/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    website TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(country_id)
        REFERENCES countries(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    comment TEXT NOT NULL,
    approved INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brand_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL,
    country_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    website TEXT DEFAULT '',
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(country_id)
        REFERENCES countries(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL UNIQUE,
    submission_id INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 1,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(submission_id)
        REFERENCES brand_submissions(id)
        ON DELETE CASCADE
);
`);

/* =========================================================
   250 COUNTRIES / TERRITORIES
========================================================= */

const countries = [
    ["AF", "Afghanistan"],
    ["AL", "Albania"],
    ["DZ", "Algeria"],
    ["AS", "American Samoa"],
    ["AD", "Andorra"],
    ["AO", "Angola"],
    ["AI", "Anguilla"],
    ["AQ", "Antarctica"],
    ["AG", "Antigua and Barbuda"],
    ["AR", "Argentina"],
    ["AM", "Armenia"],
    ["AW", "Aruba"],
    ["AU", "Australia"],
    ["AT", "Austria"],
    ["AZ", "Azerbaijan"],
    ["BS", "Bahamas"],
    ["BH", "Bahrain"],
    ["BD", "Bangladesh"],
    ["BB", "Barbados"],
    ["BY", "Belarus"],
    ["BE", "Belgium"],
    ["BZ", "Belize"],
    ["BJ", "Benin"],
    ["BM", "Bermuda"],
    ["BT", "Bhutan"],
    ["BO", "Bolivia"],
    ["BQ", "Bonaire, Sint Eustatius and Saba"],
    ["BA", "Bosnia and Herzegovina"],
    ["BW", "Botswana"],
    ["BV", "Bouvet Island"],
    ["BR", "Brazil"],
    ["IO", "British Indian Ocean Territory"],
    ["BN", "Brunei"],
    ["BG", "Bulgaria"],
    ["BF", "Burkina Faso"],
    ["BI", "Burundi"],
    ["CV", "Cabo Verde"],
    ["KH", "Cambodia"],
    ["CM", "Cameroon"],
    ["CA", "Canada"],
    ["KY", "Cayman Islands"],
    ["CF", "Central African Republic"],
    ["TD", "Chad"],
    ["CL", "Chile"],
    ["CN", "China"],
    ["CX", "Christmas Island"],
    ["CC", "Cocos (Keeling) Islands"],
    ["CO", "Colombia"],
    ["KM", "Comoros"],
    ["CG", "Congo"],
    ["CD", "Congo, Democratic Republic of the"],
    ["CK", "Cook Islands"],
    ["CR", "Costa Rica"],
    ["CI", "Côte d'Ivoire"],
    ["HR", "Croatia"],
    ["CU", "Cuba"],
    ["CW", "Curaçao"],
    ["CY", "Cyprus"],
    ["CZ", "Czechia"],
    ["DK", "Denmark"],
    ["DJ", "Djibouti"],
    ["DM", "Dominica"],
    ["DO", "Dominican Republic"],
    ["EC", "Ecuador"],
    ["EG", "Egypt"],
    ["SV", "El Salvador"],
    ["GQ", "Equatorial Guinea"],
    ["ER", "Eritrea"],
    ["EE", "Estonia"],
    ["SZ", "Eswatini"],
    ["ET", "Ethiopia"],
    ["FK", "Falkland Islands"],
    ["FO", "Faroe Islands"],
    ["FJ", "Fiji"],
    ["FI", "Finland"],
    ["FR", "France"],
    ["GF", "French Guiana"],
    ["PF", "French Polynesia"],
    ["TF", "French Southern Territories"],
    ["GA", "Gabon"],
    ["GM", "Gambia"],
    ["GE", "Georgia"],
    ["DE", "Germany"],
    ["GH", "Ghana"],
    ["GI", "Gibraltar"],
    ["GR", "Greece"],
    ["GL", "Greenland"],
    ["GD", "Grenada"],
    ["GP", "Guadeloupe"],
    ["GU", "Guam"],
    ["GT", "Guatemala"],
    ["GG", "Guernsey"],
    ["GN", "Guinea"],
    ["GW", "Guinea-Bissau"],
    ["GY", "Guyana"],
    ["HT", "Haiti"],
    ["HM", "Heard Island and McDonald Islands"],
    ["VA", "Holy See"],
    ["HN", "Honduras"],
    ["HK", "Hong Kong"],
    ["HU", "Hungary"],
    ["IS", "Iceland"],
    ["IN", "India"],
    ["ID", "Indonesia"],
    ["IR", "Iran"],
    ["IQ", "Iraq"],
    ["IE", "Ireland"],
    ["IM", "Isle of Man"],
    ["IL", "Israel"],
    ["IT", "Italy"],
    ["JM", "Jamaica"],
    ["JP", "Japan"],
    ["JE", "Jersey"],
    ["JO", "Jordan"],
    ["KZ", "Kazakhstan"],
    ["KE", "Kenya"],
    ["KI", "Kiribati"],
    ["KP", "North Korea"],
    ["KR", "South Korea"],
    ["KW", "Kuwait"],
    ["KG", "Kyrgyzstan"],
    ["LA", "Laos"],
    ["LV", "Latvia"],
    ["LB", "Lebanon"],
    ["LS", "Lesotho"],
    ["LR", "Liberia"],
    ["LY", "Libya"],
    ["LI", "Liechtenstein"],
    ["LT", "Lithuania"],
    ["LU", "Luxembourg"],
    ["MO", "Macao"],
    ["MG", "Madagascar"],
    ["MW", "Malawi"],
    ["MY", "Malaysia"],
    ["MV", "Maldives"],
    ["ML", "Mali"],
    ["MT", "Malta"],
    ["MH", "Marshall Islands"],
    ["MQ", "Martinique"],
    ["MR", "Mauritania"],
    ["MU", "Mauritius"],
    ["YT", "Mayotte"],
    ["MX", "Mexico"],
    ["FM", "Micronesia"],
    ["MD", "Moldova"],
    ["MC", "Monaco"],
    ["MN", "Mongolia"],
    ["ME", "Montenegro"],
    ["MS", "Montserrat"],
    ["MA", "Morocco"],
    ["MZ", "Mozambique"],
    ["MM", "Myanmar"],
    ["NA", "Namibia"],
    ["NR", "Nauru"],
    ["NP", "Nepal"],
    ["NL", "Netherlands"],
    ["NC", "New Caledonia"],
    ["NZ", "New Zealand"],
    ["NI", "Nicaragua"],
    ["NE", "Niger"],
    ["NG", "Nigeria"],
    ["NU", "Niue"],
    ["NF", "Norfolk Island"],
    ["MK", "North Macedonia"],
    ["MP", "Northern Mariana Islands"],
    ["NO", "Norway"],
    ["OM", "Oman"],
    ["PK", "Pakistan"],
    ["PW", "Palau"],
    ["PS", "Palestine"],
    ["PA", "Panama"],
    ["PG", "Papua New Guinea"],
    ["PY", "Paraguay"],
    ["PE", "Peru"],
    ["PH", "Philippines"],
    ["PN", "Pitcairn"],
    ["PL", "Poland"],
    ["PT", "Portugal"],
    ["PR", "Puerto Rico"],
    ["QA", "Qatar"],
    ["RE", "Réunion"],
    ["RO", "Romania"],
    ["RU", "Russia"],
    ["RW", "Rwanda"],
    ["BL", "Saint Barthélemy"],
    ["SH", "Saint Helena"],
    ["KN", "Saint Kitts and Nevis"],
    ["LC", "Saint Lucia"],
    ["MF", "Saint Martin"],
    ["PM", "Saint Pierre and Miquelon"],
    ["VC", "Saint Vincent and the Grenadines"],
    ["WS", "Samoa"],
    ["SM", "San Marino"],
    ["ST", "Sao Tome and Principe"],
    ["SA", "Saudi Arabia"],
    ["SN", "Senegal"],
    ["RS", "Serbia"],
    ["SC", "Seychelles"],
    ["SL", "Sierra Leone"],
    ["SG", "Singapore"],
    ["SX", "Sint Maarten"],
    ["SK", "Slovakia"],
    ["SI", "Slovenia"],
    ["SB", "Solomon Islands"],
    ["SO", "Somalia"],
    ["ZA", "South Africa"],
    ["GS", "South Georgia and the South Sandwich Islands"],
    ["SS", "South Sudan"],
    ["ES", "Spain"],
    ["LK", "Sri Lanka"],
    ["SD", "Sudan"],
    ["SR", "Suriname"],
    ["SJ", "Svalbard and Jan Mayen"],
    ["SE", "Sweden"],
    ["CH", "Switzerland"],
    ["SY", "Syria"],
    ["TW", "Taiwan"],
    ["TJ", "Tajikistan"],
    ["TZ", "Tanzania"],
    ["TH", "Thailand"],
    ["TL", "Timor-Leste"],
    ["TG", "Togo"],
    ["TK", "Tokelau"],
    ["TO", "Tonga"],
    ["TT", "Trinidad and Tobago"],
    ["TN", "Tunisia"],
    ["TR", "Turkey"],
    ["TM", "Turkmenistan"],
    ["TC", "Turks and Caicos Islands"],
    ["TV", "Tuvalu"],
    ["UG", "Uganda"],
    ["UA", "Ukraine"],
    ["AE", "United Arab Emirates"],
    ["GB", "United Kingdom"],
    ["US", "United States"],
    ["UM", "United States Minor Outlying Islands"],
    ["UY", "Uruguay"],
    ["UZ", "Uzbekistan"],
    ["VU", "Vanuatu"],
    ["VE", "Venezuela"],
    ["VN", "Vietnam"],
    ["VG", "Virgin Islands, British"],
    ["VI", "Virgin Islands, U.S."],
    ["WF", "Wallis and Futuna"],
    ["EH", "Western Sahara"],
    ["YE", "Yemen"],
    ["ZM", "Zambia"],
    ["ZW", "Zimbabwe"],
    ["AX", "Åland Islands"],
    ["XK", "Kosovo"]
];

if (countries.length !== 250) {
    throw new Error(
        `Countries list must contain 250 entries. Current: ${countries.length}`
    );
}

/* =========================================================
   SEED COUNTRIES
========================================================= */

const insertCountry = db.prepare(`
    INSERT OR IGNORE INTO countries
    (code, name)
    VALUES (?, ?)
`);

const seedCountries = db.transaction(() => {

    for (const [code, name] of countries) {
        insertCountry.run(code, name);
    }

});

seedCountries();

/* =========================================================
   STARTER BRANDS
========================================================= */

const starterBrands = [
    ["Apple", "US", "Technology company", "https://www.apple.com"],
    ["Nike", "US", "Sportswear brand", "https://www.nike.com"],
    ["Microsoft", "US", "Technology company", "https://www.microsoft.com"],
    ["BMW", "DE", "Automotive brand", "https://www.bmw.com"],
    ["Mercedes-Benz", "DE", "Automotive brand", "https://www.mercedes-benz.com"],
    ["Samsung", "KR", "Technology company", "https://www.samsung.com"],
    ["Toyota", "JP", "Automotive brand", "https://www.toyota.com"],
    ["Sony", "JP", "Technology and entertainment", "https://www.sony.com"],
    ["Huawei", "CN", "Technology company", "https://www.huawei.com"],
    ["L'Oréal", "FR", "Beauty company", "https://www.loreal.com"],
    ["Ferrari", "IT", "Automotive brand", "https://www.ferrari.com"],
    ["Artel", "UZ", "Technology and home appliances", "https://artelgroup.org"],
    ["Arçelik", "TR", "Home appliances", "https://www.arcelik.com.tr"],
    ["Tata", "IN", "Business group", "https://www.tata.com"]
];

const findCountry =
    db.prepare(`
        SELECT id
        FROM countries
        WHERE code = ?
    `);

const brandExists =
    db.prepare(`
        SELECT id
        FROM brands
        WHERE name = ?
        AND country_id = ?
    `);

const insertBrand =
    db.prepare(`
        INSERT INTO brands
        (name, country_id, description, website)
        VALUES (?, ?, ?, ?)
    `);

for (const brand of starterBrands) {

    const [name, code, description, website] = brand;

    const country = findCountry.get(code);

    if (!country) {
        continue;
    }

    if (
        !brandExists.get(
            name,
            country.id
        )
    ) {
        insertBrand.run(
            name,
            country.id,
            description,
            website
        );
    }
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value, max = 500) {

    return String(value ?? "")
        .replace(/[<>]/g, "")
        .trim()
        .slice(0, max);
}

function validEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(String(email || ""));
}

function isSafeUrl(value) {

    if (!value) {
        return true;
    }

    try {

        const url =
            new URL(value);

        return [
            "http:",
            "https:"
        ].includes(url.protocol);

    } catch {

        return false;

    }
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {

    res.json({
        ok: true,
        site: "ALL WORLD BRANDS",
        countries: 250,
        brand_price: 1,
        currency: "USD"
    });

});

/* =========================================================
   COUNTRIES
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

    res.json(rows);

});

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
                error: "Invalid country ID"
            });
        }

        const brands =
            db.prepare(`
                SELECT
                    id,
                    name,
                    description,
                    website,
                    logo_url,
                    created_at
                FROM brands
                WHERE country_id = ?
                ORDER BY name COLLATE NOCASE
            `).all(id);

        res.json(brands);

    }
);

/* =========================================================
   ALL BRANDS
========================================================= */

app.get("/api/brands", (req, res) => {

    const brands =
        db.prepare(`
            SELECT
                b.id,
                b.name,
                b.description,
                b.website,
                b.logo_url,
                c.id AS country_id,
                c.name AS country_name,
                c.code AS country_code,
                b.created_at
            FROM brands b
            JOIN countries c
                ON c.id = b.country_id
            ORDER BY b.created_at DESC
        `).all();

    res.json(brands);

});

/* =========================================================
   SEARCH
========================================================= */

app.get("/api/search", (req, res) => {

    const q =
        cleanText(req.query.q, 100);

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
                c.code AS country_code
            FROM brands b
            JOIN countries c
                ON c.id = b.country_id
            WHERE
                b.name LIKE ?
                OR b.description LIKE ?
                OR c.name LIKE ?
                OR c.code LIKE ?
            ORDER BY b.name COLLATE NOCASE
            LIMIT 100
        `).all(
            search,
            search,
            search,
            search
        );

    res.json(results);

});

/* =========================================================
   COMMENTS
========================================================= */

app.get("/api/comments", (req, res) => {

    const comments =
        db.prepare(`
            SELECT
                id,
                name,
                comment,
                created_at
            FROM comments
            WHERE approved = 1
            ORDER BY created_at DESC
            LIMIT 100
        `).all();

    res.json(comments);

});

app.post("/api/comments", (req, res) => {

    const name =
        cleanText(req.body.name, 80);

    const email =
        cleanText(req.body.email, 120);

    const comment =
        cleanText(req.body.comment, 1000);

    if (!name) {

        return res.status(400).json({
            error: "Name is required"
        });

    }

    if (!comment) {

        return res.status(400).json({
            error: "Comment is required"
        });

    }

    if (
        email &&
        !validEmail(email)
    ) {

        return res.status(400).json({
            error: "Invalid email"
        });

    }

    const result =
        db.prepare(`
            INSERT INTO comments
            (name, email, comment, approved)
            VALUES (?, ?, ?, 1)
        `).run(
            name,
            email,
            comment
        );

    res.status(201).json({
        ok: true,
        id: result.lastInsertRowid
    });

});

/* =========================================================
   BRAND SUBMISSION
   PRICE IS FIXED TO $1
========================================================= */

app.post(
    "/api/brand-submissions",
    (req, res) => {

        const brandName =
            cleanText(
                req.body.brand_name,
                120
            );

        const countryId =
            Number(
                req.body.country_id
            );

        const description =
            cleanText(
                req.body.description,
                1000
            );

        const website =
            cleanText(
                req.body.website,
                500
            );

        const contactName =
            cleanText(
                req.body.contact_name,
                120
            );

        const email =
            cleanText(
                req.body.email,
                160
            );

        if (!brandName) {

            return res.status(400).json({
                error: "Brand name is required"
            });

        }

        if (
            !Number.isInteger(countryId)
        ) {

            return res.status(400).json({
                error: "Country is required"
            });

        }

        if (!contactName) {

            return res.status(400).json({
                error: "Contact name is required"
            });

        }

        if (!validEmail(email)) {

            return res.status(400).json({
                error: "Valid email is required"
            });

        }

        if (!isSafeUrl(website)) {

            return res.status(400).json({
                error: "Invalid website URL"
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
                error: "Country not found"
            });

        }

        /*
         * FIXED PRICE:
         * 1 USD
         *
         * Payment is NOT trusted from browser.
         * A real payment provider/webhook must
         * change payment_status to "paid".
         */

        const result =
            db.prepare(`
                INSERT INTO brand_submissions
                (
                    brand_name,
                    country_id,
                    description,
                    website,
                    contact_name,
                    email,
                    amount,
                    currency,
                    payment_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                brandName,
                countryId,
                description,
                website,
                contactName,
                email,
                1,
                "USD",
                "unpaid"
            );

        res.status(201).json({
            ok: true,
            submission_id:
                result.lastInsertRowid,
            amount: 1,
            currency: "USD",
            payment_status: "unpaid",
            message:
                "Brand submission created. Payment amount is $1 USD."
        });

    }
);

/* =========================================================
   PAYMENT RECORD
   No OCTO.
   No fake successful payment.
========================================================= */

app.post(
    "/api/payments/create",
    (req, res) => {

        const submissionId =
            Number(
                req.body.submission_id
            );

        if (
            !Number.isInteger(
                submissionId
            )
        ) {

            return res.status(400).json({
                error:
                    "Invalid submission ID"
            });

        }

        const submission =
            db.prepare(`
                SELECT
                    id,
                    amount,
                    currency,
                    payment_status
                FROM brand_submissions
                WHERE id = ?
            `).get(
                submissionId
            );

        if (!submission) {

            return res.status(404).json({
                error:
                    "Submission not found"
            });

        }

        if (
            submission.payment_status ===
            "paid"
        ) {

            return res.json({
                ok: true,
                already_paid: true,
                amount: 1,
                currency: "USD"
            });

        }

        const paymentId =
            "AWB-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 10)
                .toUpperCase();

        db.prepare(`
            INSERT INTO payments
            (
                payment_id,
                submission_id,
                amount,
                currency,
                status
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            paymentId,
            submissionId,
            1,
            "USD",
            "pending"
        );

        db.prepare(`
            UPDATE brand_submissions
            SET payment_id = ?
            WHERE id = ?
        `).run(
            paymentId,
            submissionId
        );

        /*
         * IMPORTANT:
         * This endpoint DOES NOT mark payment as paid.
         * The actual payment provider must confirm payment
         * server-to-server/webhook before "paid".
         */

        res.json({
            ok: true,
            payment_id: paymentId,
            amount: 1,
            currency: "USD",
            status: "pending",
            message:
                "Payment record created for $1 USD."
        });

    }
);

/* =========================================================
   INFO
========================================================= */

app.get("/api/info", (req, res) => {

    res.json({

        site_name:
            "ALL WORLD BRANDS",

        phone:
            "+998933843112",

        whatsapp:
            "+998933843112",

        email:
            "allworldbrandsnet@gmail.com",

        website:
            SITE_URL,

        brand_submission_price:
            1,

        currency:
            "USD"

    });

});

/* =========================================================
   ROBOTS
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

    res.type("application/xml");

    res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
    <url>
        <loc>${SITE_URL}/</loc>
    </url>
    <url>
        <loc>${SITE_URL}/#countries</loc>
    </url>
    <url>
        <loc>${SITE_URL}/#brands</loc>
    </url>
    <url>
        <loc>${SITE_URL}/#comments</loc>
    </url>
    <url>
        <loc>${SITE_URL}/#info</loc>
    </url>
</urlset>`
    );

});

/* =========================================================
   FALLBACK
========================================================= */

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (err, req, res, next) => {

        console.error(err);

        res.status(500).json({
            error:
                "Internal server error"
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
            `Countries: ${countries.length}`
        );

        console.log(
            `Brand price: $1 USD`
        );

    }
);
