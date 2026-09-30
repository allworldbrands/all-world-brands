const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const SITE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const DB_FILE =
    process.env.DB_FILE ||
    path.join(__dirname, "database.db");

const db = new Database(DB_FILE);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

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

    amount REAL DEFAULT 1,
    currency TEXT DEFAULT 'USD',

    payment_status TEXT DEFAULT 'unpaid',
    payment_reference TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(country_id)
    REFERENCES countries(id)
);
`);


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

function uniqueSlug(table, base, id = null) {
    let slug = slugify(base) || crypto.randomUUID();

    let candidate = slug;
    let number = 2;

    while (true) {
        let sql;

        if (table === "countries") {
            sql = id
                ? db.prepare(
                    "SELECT id FROM countries WHERE slug = ? AND id != ?"
                  ).get(candidate, id)
                : db.prepare(
                    "SELECT id FROM countries WHERE slug = ?"
                  ).get(candidate);
        } else {
            sql = id
                ? db.prepare(
                    "SELECT id FROM brands WHERE slug = ? AND id != ?"
                  ).get(candidate, id)
                : db.prepare(
                    "SELECT id FROM brands WHERE slug = ?"
                  ).get(candidate);
        }

        if (!sql) return candidate;

        candidate = `${slug}-${number++}`;
    }
}

function safeUrl(value) {
    if (!value) return "";

    try {
        const url = new URL(value);

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


/* =========================================================
   COUNTRIES
========================================================= */

const countries = [
    ["Afghanistan","AF","🇦🇫"],
    ["Albania","AL","🇦🇱"],
    ["Algeria","DZ","🇩🇿"],
    ["Andorra","AD","🇦🇩"],
    ["Angola","AO","🇦🇴"],
    ["Antigua and Barbuda","AG","🇦🇬"],
    ["Argentina","AR","🇦🇷"],
    ["Armenia","AM","🇦🇲"],
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
    ["Bhutan","BT","🇧🇹"],
    ["Bolivia","BO","🇧🇴"],
    ["Bosnia and Herzegovina","BA","🇧🇦"],
    ["Botswana","BW","🇧🇼"],
    ["Brazil","BR","🇧🇷"],
    ["Brunei","BN","🇧🇳"],
    ["Bulgaria","BG","🇧🇬"],
    ["Burkina Faso","BF","🇧🇫"],
    ["Burundi","BI","🇧🇮"],
    ["Cabo Verde","CV","🇨🇻"],
    ["Cambodia","KH","🇰🇭"],
    ["Cameroon","CM","🇨🇲"],
    ["Canada","CA","🇨🇦"],
    ["Central African Republic","CF","🇨🇫"],
    ["Chad","TD","🇹🇩"],
    ["Chile","CL","🇨🇱"],
    ["China","CN","🇨🇳"],
    ["Colombia","CO","🇨🇴"],
    ["Comoros","KM","🇰🇲"],
    ["Congo","CG","🇨🇬"],
    ["Costa Rica","CR","🇨🇷"],
    ["Croatia","HR","🇭🇷"],
    ["Cuba","CU","🇨🇺"],
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
    ["Fiji","FJ","🇫🇯"],
    ["Finland","FI","🇫🇮"],
    ["France","FR","🇫🇷"],
    ["Gabon","GA","🇬🇦"],
    ["Gambia","GM","🇬🇲"],
    ["Georgia","GE","🇬🇪"],
    ["Germany","DE","🇩🇪"],
    ["Ghana","GH","🇬🇭"],
    ["Greece","GR","🇬🇷"],
    ["Grenada","GD","🇬🇩"],
    ["Guatemala","GT","🇬🇹"],
    ["Guinea","GN","🇬🇳"],
    ["Guinea-Bissau","GW","🇬🇼"],
    ["Guyana","GY","🇬🇾"],
    ["Haiti","HT","🇭🇹"],
    ["Honduras","HN","🇭🇳"],
    ["Hungary","HU","🇭🇺"],
    ["Iceland","IS","🇮🇸"],
    ["India","IN","🇮🇳"],
    ["Indonesia","ID","🇮🇩"],
    ["Iran","IR","🇮🇷"],
    ["Iraq","IQ","🇮🇶"],
    ["Ireland","IE","🇮🇪"],
    ["Israel","IL","🇮🇱"],
    ["Italy","IT","🇮🇹"],
    ["Jamaica","JM","🇯🇲"],
    ["Japan","JP","🇯🇵"],
    ["Jordan","JO","🇯🇴"],
    ["Kazakhstan","KZ","🇰🇿"],
    ["Kenya","KE","🇰🇪"],
    ["Kiribati","KI","🇰🇮"],
    ["Kuwait","KW","🇰🇼"],
    ["Kyrgyzstan","KG","🇰🇬"],
    ["Laos","LA","🇱🇦"],
    ["Latvia","LV","🇱🇻"],
    ["Lebanon","LB","🇱🇧"],
    ["Lesotho","LS","🇱🇸"],
    ["Liberia","LR","🇱🇷"],
    ["Libya","LY","🇱🇾"],
    ["Liechtenstein","LI","🇱🇮"],
    ["Lithuania","LT","🇱🇹"],
    ["Luxembourg","LU","🇱🇺"],
    ["Madagascar","MG","🇲🇬"],
    ["Malawi","MW","🇲🇼"],
    ["Malaysia","MY","🇲🇾"],
    ["Maldives","MV","🇲🇻"],
    ["Mali","ML","🇲🇱"],
    ["Malta","MT","🇲🇹"],
    ["Marshall Islands","MH","🇲🇭"],
    ["Mauritania","MR","🇲🇷"],
    ["Mauritius","MU","🇲🇺"],
    ["Mexico","MX","🇲🇽"],
    ["Micronesia","FM","🇫🇲"],
    ["Moldova","MD","🇲🇩"],
    ["Monaco","MC","🇲🇨"],
    ["Mongolia","MN","🇲🇳"],
    ["Montenegro","ME","🇲🇪"],
    ["Morocco","MA","🇲🇦"],
    ["Mozambique","MZ","🇲🇿"],
    ["Myanmar","MM","🇲🇲"],
    ["Namibia","NA","🇳🇦"],
    ["Nauru","NR","🇳🇷"],
    ["Nepal","NP","🇳🇵"],
    ["Netherlands","NL","🇳🇱"],
    ["New Zealand","NZ","🇳🇿"],
    ["Nicaragua","NI","🇳🇮"],
    ["Niger","NE","🇳🇪"],
    ["Nigeria","NG","🇳🇬"],
    ["North Korea","KP","🇰🇵"],
    ["North Macedonia","MK","🇲🇰"],
    ["Norway","NO","🇳🇴"],
    ["Oman","OM","🇴🇲"],
    ["Pakistan","PK","🇵🇰"],
    ["Palau","PW","🇵🇼"],
    ["Panama","PA","🇵🇦"],
    ["Papua New Guinea","PG","🇵🇬"],
    ["Paraguay","PY","🇵🇾"],
    ["Peru","PE","🇵🇪"],
    ["Philippines","PH","🇵🇭"],
    ["Poland","PL","🇵🇱"],
    ["Portugal","PT","🇵🇹"],
    ["Qatar","QA","🇶🇦"],
    ["Romania","RO","🇷🇴"],
    ["Russia","RU","🇷🇺"],
    ["Rwanda","RW","🇷🇼"],
    ["Saint Kitts and Nevis","KN","🇰🇳"],
    ["Saint Lucia","LC","🇱🇨"],
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
    ["Slovakia","SK","🇸🇰"],
    ["Slovenia","SI","🇸🇮"],
    ["Solomon Islands","SB","🇸🇧"],
    ["Somalia","SO","🇸🇴"],
    ["South Africa","ZA","🇿🇦"],
    ["South Korea","KR","🇰🇷"],
    ["South Sudan","SS","🇸🇸"],
    ["Spain","ES","🇪🇸"],
    ["Sri Lanka","LK","🇱🇰"],
    ["Sudan","SD","🇸🇩"],
    ["Suriname","SR","🇸🇷"],
    ["Sweden","SE","🇸🇪"],
    ["Switzerland","CH","🇨🇭"],
    ["Syria","SY","🇸🇾"],
    ["Taiwan","TW","🇹🇼"],
    ["Tajikistan","TJ","🇹🇯"],
    ["Tanzania","TZ","🇹🇿"],
    ["Thailand","TH","🇹🇭"],
    ["Timor-Leste","TL","🇹🇱"],
    ["Togo","TG","🇹🇬"],
    ["Tonga","TO","🇹🇴"],
    ["Trinidad and Tobago","TT","🇹🇹"],
    ["Tunisia","TN","🇹🇳"],
    ["Turkey","TR","🇹🇷"],
    ["Turkmenistan","TM","🇹🇲"],
    ["Tuvalu","TV","🇹🇻"],
    ["Uganda","UG","🇺🇬"],
    ["Ukraine","UA","🇺🇦"],
    ["United Arab Emirates","AE","🇦🇪"],
    ["United Kingdom","GB","🇬🇧"],
    ["United States","US","🇺🇸"],
    ["Uruguay","UY","🇺🇾"],
    ["Uzbekistan","UZ","🇺🇿"],
    ["Vanuatu","VU","🇻🇺"],
    ["Vatican City","VA","🇻🇦"],
    ["Venezuela","VE","🇻🇪"],
    ["Vietnam","VN","🇻🇳"],
    ["Yemen","YE","🇾🇪"],
    ["Zambia","ZM","🇿🇲"],
    ["Zimbabwe","ZW","🇿🇼"]
];

const insertCountry =
    db.prepare(`
        INSERT OR IGNORE INTO countries
        (name, code, flag, slug)
        VALUES (?, ?, ?, ?)
    `);

const seedCountries =
    db.transaction(() => {
        for (const [name, code, flag] of countries) {
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
   STARTER BRANDS
========================================================= */

const starterBrands = [
    ["Apple","United States","https://logo.clearbit.com/apple.com"],
    ["Microsoft","United States","https://logo.clearbit.com/microsoft.com"],
    ["Nike","United States","https://logo.clearbit.com/nike.com"],
    ["Coca-Cola","United States","https://logo.clearbit.com/coca-cola.com"],
    ["BMW","Germany","https://logo.clearbit.com/bmw.com"],
    ["Mercedes-Benz","Germany","https://logo.clearbit.com/mercedes-benz.com"],
    ["Adidas","Germany","https://logo.clearbit.com/adidas.com"],
    ["Toyota","Japan","https://logo.clearbit.com/toyota.com"],
    ["Samsung","South Korea","https://logo.clearbit.com/samsung.com"],
    ["Huawei","China","https://logo.clearbit.com/huawei.com"],
    ["L'Oréal","France","https://logo.clearbit.com/loreal.com"],
    ["Ferrari","Italy","https://logo.clearbit.com/ferrari.com"],
    ["Arçelik","Turkey","https://logo.clearbit.com/arcelik.com"],
    ["Artel","Uzbekistan",""],
    ["Tata","India","https://logo.clearbit.com/tata.com"]
];

const addStarter =
    db.prepare(`
        INSERT OR IGNORE INTO brands
        (country_id, name, slug, logo)
        VALUES (?, ?, ?, ?)
    `);

for (const [name, countryName, logo] of starterBrands) {

    const country =
        db.prepare(
            "SELECT id FROM countries WHERE name = ?"
        ).get(countryName);

    if (!country) continue;

    const exists =
        db.prepare(
            "SELECT id FROM brands WHERE name = ? AND country_id = ?"
        ).get(name, country.id);

    if (!exists) {

        addStarter.run(
            country.id,
            name,
            uniqueSlug("brands", name),
            logo
        );

    }
}


/* =========================================================
   API — COUNTRIES
========================================================= */

app.get("/api/countries", (req, res) => {

    const rows =
        db.prepare(`
            SELECT
                c.id,
                c.name,
                c.code,
                c.flag,
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
   API — COUNTRY BRANDS
========================================================= */

app.get(
    "/api/countries/:id/brands",
    (req, res) => {

        const country =
            db.prepare(
                "SELECT * FROM countries WHERE id = ?"
            ).get(req.params.id);

        if (!country) {
            return res.status(404).json({
                error: "Country not found"
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
                ORDER BY name COLLATE NOCASE
            `).all(country.id);

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
            `).get(req.params.id);

        if (!brand) {
            return res.status(404).json({
                error: "Brand not found"
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
                ORDER BY created_at DESC
            `).all(brand.id);

        res.json({
            brand,
            comments
        });
    }
);


/* =========================================================
   API — SEARCH
========================================================= */

app.get("/api/search", (req, res) => {

    const q =
        String(req.query.q || "")
            .trim();

    if (!q) {
        return res.json([]);
    }

    const like = `%${q}%`;

    const rows =
        db.prepare(`
            SELECT
                b.id,
                b.name,
                b.logo,
                b.slug,
                c.id AS country_id,
                c.name AS country_name,
                c.flag AS country_flag
            FROM brands b
            JOIN countries c
                ON c.id = b.country_id
            WHERE
                b.name LIKE ?
                OR c.name LIKE ?
            ORDER BY b.name COLLATE NOCASE
            LIMIT 100
        `).all(like, like);

    res.json(rows);
});


/* =========================================================
   COMMENTS
   NO EMAIL
========================================================= */

app.post(
    "/api/comments",
    (req, res) => {

        const name =
            String(req.body.name || "")
                .trim()
                .slice(0, 80);

        const comment =
            String(req.body.comment || "")
                .trim()
                .slice(0, 1000);

        const brandId =
            req.body.brand_id
                ? Number(req.body.brand_id)
                : null;

        const countryId =
            req.body.country_id
                ? Number(req.body.country_id)
                : null;

        if (!name || !comment) {

            return res.status(400).json({
                error:
                    "Name and comment are required"
            });

        }

        if (!brandId && !countryId) {

            return res.status(400).json({
                error:
                    "Brand or country is required"
            });

        }

        if (
            brandId &&
            !db.prepare(
                "SELECT id FROM brands WHERE id = ?"
            ).get(brandId)
        ) {
            return res.status(404).json({
                error: "Brand not found"
            });
        }

        if (
            countryId &&
            !db.prepare(
                "SELECT id FROM countries WHERE id = ?"
            ).get(countryId)
        ) {
            return res.status(404).json({
                error: "Country not found"
            });
        }

        const result =
            db.prepare(`
                INSERT INTO comments
                (brand_id, country_id, name, comment)
                VALUES (?, ?, ?, ?)
            `).run(
                brandId,
                countryId,
                name,
                comment
            );

        res.status(201).json({
            success: true,
            id: result.lastInsertRowid
        });
    }
);


/* =========================================================
   BRAND APPLICATION
   PRICE = $1
========================================================= */

app.post(
    "/api/brand-applications",
    (req, res) => {

        const countryId =
            Number(req.body.country_id);

        const brandName =
            String(req.body.brand_name || "")
                .trim()
                .slice(0, 150);

        const logo =
            safeUrl(req.body.logo);

        const website =
            safeUrl(req.body.website);

        const description =
            String(req.body.description || "")
                .trim()
                .slice(0, 3000);

        const contactName =
            String(req.body.contact_name || "")
                .trim()
                .slice(0, 120);

        const contactPhone =
            String(req.body.contact_phone || "")
                .trim()
                .slice(0, 40);

        if (!countryId || !brandName) {

            return res.status(400).json({
                error:
                    "Country and brand name are required"
            });

        }

        const country =
            db.prepare(
                "SELECT id FROM countries WHERE id = ?"
            ).get(countryId);

        if (!country) {

            return res.status(404).json({
                error: "Country not found"
            });

        }

        /*
         * Important:
         * Application is created as UNPAID.
         * The server does NOT trust payment_status
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
                    amount,
                    currency,
                    payment_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'USD', 'unpaid')
            `).run(
                countryId,
                brandName,
                logo,
                website,
                description,
                contactName,
                contactPhone
            );

        res.status(201).json({
            success: true,
            application_id:
                result.lastInsertRowid,
            amount: 1,
            currency: "USD",
            payment_status: "unpaid",
            message:
                "Brand application created. Payment of $1 is required."
        });
    }
);


/* =========================================================
   PAYMENT STATUS
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
                    created_at
                FROM brand_applications
                WHERE id = ?
            `).get(req.params.id);

        if (!application) {

            return res.status(404).json({
                error: "Application not found"
            });

        }

        res.json(application);
    }
);


/* =========================================================
   HTML PAGES
========================================================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


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

    const countryRows =
        db.prepare(
            "SELECT id FROM countries"
        ).all();

    const brandRows =
        db.prepare(
            "SELECT id FROM brands"
        ).all();

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
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `
<url>
<loc>${url}</loc>
</url>`).join("")}
</urlset>`;

    res.type("application/xml");
    res.send(xml);

});


/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {

    res.json({
        ok: true,
        site: "ALL WORLD BRANDS",
        countries:
            db.prepare(
                "SELECT COUNT(*) AS count FROM countries"
            ).get().count,
        brands:
            db.prepare(
                "SELECT COUNT(*) AS count FROM brands"
            ).get().count
    });

});


/* =========================================================
   404
========================================================= */

app.use((req, res) => {

    if (req.path.startsWith("/api/")) {

        return res.status(404).json({
            error: "Not found"
        });

    }

    res.status(404).send(
        "Page not found"
    );

});


/* =========================================================
   SERVER
========================================================= */

app.listen(PORT, () => {

    console.log(
        `ALL WORLD BRANDS running on port ${PORT}`
    );

});
