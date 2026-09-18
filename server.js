const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const SITE_URL = "https://allworldbrands.net";

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(morgan("combined"));

app.use(
  express.json({
    limit: "50kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50kb"
  })
);

/* =====================================================
   DATABASE
   ===================================================== */

const db = new sqlite3.Database(
  path.join(__dirname, "allworldbrands.db")
);

/* =====================================================
   COUNTRIES + TERRITORIES
   ===================================================== */

const countries = [
  ["Afghanistan", "AF"],
  ["Åland Islands", "AX"],
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
  ["British Virgin Islands", "VG"],
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
  ["Côte d'Ivoire", "CI"],
  ["Croatia", "HR"],
  ["Cuba", "CU"],
  ["Curaçao", "CW"],
  ["Cyprus", "CY"],
  ["Czech Republic", "CZ"],
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
  ["Holy See (Vatican City State)", "VA"],
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
  ["North Korea", "KP"],
  ["South Korea", "KR"],
  ["Kosovo", "XK"],
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
  ["Macau", "MO"],
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
  ["Pitcairn Islands", "PN"],
  ["Poland", "PL"],
  ["Portugal", "PT"],
  ["Puerto Rico", "PR"],
  ["Qatar", "QA"],
  ["Réunion", "RE"],
  ["Romania", "RO"],
  ["Russia", "RU"],
  ["Rwanda", "RW"],
  ["Saint Barthélemy", "BL"],
  ["Saint Helena", "SH"],
  ["Saint Kitts and Nevis", "KN"],
  ["Saint Lucia", "LC"],
  ["Saint Martin", "MF"],
  ["Saint Pierre and Miquelon", "PM"],
  ["Saint Vincent and the Grenadines", "VC"],
  ["Samoa", "WS"],
  ["San Marino", "SM"],
  ["São Tomé and Príncipe", "ST"],
  ["Saudi Arabia", "SA"],
  ["Senegal", "SN"],
  ["Serbia", "RS"],
  ["Seychelles", "SC"],
  ["Sierra Leone", "SL"],
  ["Singapore", "SG"],
  ["Sint Maarten", "SX"],
  ["Slovakia", "SK"],
  ["Slovenia", "SI"],
  ["Solomon Islands", "SB"],
  ["Somalia", "SO"],
  ["South Africa", "ZA"],
  ["South Georgia and South Sandwich Islands", "GS"],
  ["South Sudan", "SS"],
  ["Spain", "ES"],
  ["Sri Lanka", "LK"],
  ["Sudan", "SD"],
  ["Suriname", "SR"],
  ["Svalbard and Jan Mayen", "SJ"],
  ["Sweden", "SE"],
  ["Switzerland", "CH"],
  ["Syria", "SY"],
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
  ["Turkey", "TR"],
  ["Turkmenistan", "TM"],
  ["Turks and Caicos Islands", "TC"],
  ["Tuvalu", "TV"],
  ["Uganda", "UG"],
  ["Ukraine", "UA"],
  ["United Arab Emirates", "AE"],
  ["United Kingdom", "GB"],
  ["United States", "US"],
  ["United States Minor Outlying Islands", "UM"],
  ["U.S. Virgin Islands", "VI"],
  ["Uruguay", "UY"],
  ["Uzbekistan", "UZ"],
  ["Vanuatu", "VU"],
  ["Venezuela", "VE"],
  ["Vietnam", "VN"],
  ["Wallis and Futuna", "WF"],
  ["Western Sahara", "EH"],
  ["Yemen", "YE"],
  ["Zambia", "ZM"],
  ["Zimbabwe", "ZW"]
];

/* =====================================================
   DATABASE TABLES
   ===================================================== */

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
      description TEXT,
      website TEXT,
      verification TEXT DEFAULT 'Unverified',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(country_id) REFERENCES countries(id)
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
      FOREIGN KEY(brand_id) REFERENCES brands(id)
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.all(
    `PRAGMA table_info(brands)`,
    [],
    (err, columns) => {

      if (err) {
        console.error(err);
        return;
      }

      const existing =
        columns.map(column => column.name);

      if (!existing.includes("logo")) {
        db.run(
          `ALTER TABLE brands ADD COLUMN logo TEXT DEFAULT ''`
        );
      }

      if (!existing.includes("category")) {
        db.run(
          `ALTER TABLE brands ADD COLUMN category TEXT DEFAULT ''`
        );
      }

      if (!existing.includes("verification")) {
        db.run(
          `ALTER TABLE brands ADD COLUMN verification TEXT DEFAULT 'Unverified'`
        );
      }
    }
  );

  const insertCountry = db.prepare(`
    INSERT OR IGNORE INTO countries
    (name, code)
    VALUES (?, ?)
  `);

  countries.forEach(([name, code]) => {
    insertCountry.run(name, code);
  });

  insertCountry.finalize();

  const starterBrands = [
    [
      "Apple",
      "United States",
      "",
      "Technology",
      "Technology company",
      "https://www.apple.com"
    ],
    [
      "Nike",
      "United States",
      "",
      "Sportswear",
      "Sportswear brand",
      "https://www.nike.com"
    ],
    [
      "Burberry",
      "United Kingdom",
      "",
      "Fashion",
      "Luxury fashion brand",
      "https://www.burberry.com"
    ],
    [
      "BMW",
      "Germany",
      "",
      "Automotive",
      "Automobile manufacturer",
      "https://www.bmw.com"
    ],
    [
      "L'Oréal",
      "France",
      "",
      "Beauty",
      "Beauty and cosmetics company",
      "https://www.loreal.com"
    ],
    [
      "Ferrari",
      "Italy",
      "",
      "Automotive",
      "Automobile manufacturer",
      "https://www.ferrari.com"
    ],
    [
      "Arçelik",
      "Turkey",
      "",
      "Home Appliances",
      "Home appliances",
      "https://www.arcelik.com"
    ],
    [
      "Artel",
      "Uzbekistan",
      "",
      "Electronics",
      "Electronics and home appliances",
      "https://artelelectronics.com"
    ],
    [
      "Toyota",
      "Japan",
      "",
      "Automotive",
      "Automobile manufacturer",
      "https://www.toyota.com"
    ],
    [
      "Samsung",
      "South Korea",
      "",
      "Electronics",
      "Electronics company",
      "https://www.samsung.com"
    ],
    [
      "Huawei",
      "China",
      "",
      "Technology",
      "Technology company",
      "https://www.huawei.com"
    ],
    [
      "Tata",
      "India",
      "",
      "Conglomerate",
      "Conglomerate",
      "https://www.tata.com"
    ]
  ];

  starterBrands.forEach(
    (
      [
        name,
        country,
        logo,
        category,
        description,
        website
      ]
    ) => {

      db.get(
        `SELECT id FROM countries WHERE name = ?`,
        [country],
        (err, row) => {

          if (err || !row) {
            return;
          }

          db.run(
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
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1
              FROM brands
              WHERE country_id = ?
              AND name = ?
            )
            `,
            [
              row.id,
              name,
              logo,
              category,
              description,
              website,
              "Official source",
              row.id,
              name
            ]
          );
        }
      );
    }
  );
});

/* =====================================================
   ADMIN AUTH
   ===================================================== */

function adminAuth(req, res, next) {

  const auth =
    req.headers.authorization || "";

  if (!auth.startsWith("Basic ")) {

    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );

    return res
      .status(401)
      .send("Authentication required");
  }

  const encoded = auth.slice(6);

  let decoded;

  try {

    decoded =
      Buffer
        .from(encoded, "base64")
        .toString("utf8");

  } catch (error) {

    return res
      .status(401)
      .send("Invalid authentication");
  }

  const separator =
    decoded.indexOf(":");

  if (separator === -1) {

    return res
      .status(401)
      .send("Invalid authentication");
  }

  const username =
    decoded.slice(0, separator);

  const password =
    decoded.slice(separator + 1);

  if (
    username !== process.env.ADMIN_USER ||
    password !== process.env.ADMIN_PASSWORD
  ) {

    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );

    return res
      .status(401)
      .send("Wrong username or password");
  }

  next();
}

/* =====================================================
   GLOBAL SEO HELPERS
   ===================================================== */

function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function seoPage({
  title,
  description,
  canonical,
  content,
  schema
}) {

  const safeTitle =
    escapeHtml(title);

  const safeDescription =
    escapeHtml(description);

  const safeCanonical =
    escapeHtml(canonical);

  const schemaJson =
    JSON.stringify(schema || {});

  return `<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>${safeTitle}</title>

<meta
  name="description"
  content="${safeDescription}"
>

<meta
  name="robots"
  content="index, follow, max-image-preview:large"
>

<link
  rel="canonical"
  href="${safeCanonical}"
>

<meta
  property="og:type"
  content="website"
>

<meta
  property="og:title"
  content="${safeTitle}"
>

<meta
  property="og:description"
  content="${safeDescription}"
>

<meta
  property="og:url"
  content="${safeCanonical}"
>

<meta
  property="og:site_name"
  content="ALL WORLD BRANDS"
>

<meta
  name="twitter:card"
  content="summary"
>

<meta
  name="twitter:title"
  content="${safeTitle}"
>

<meta
  name="twitter:description"
  content="${safeDescription}"
>

<script type="application/ld+json">
${schemaJson}
</script>

<style>

body {
  font-family: Arial, sans-serif;
  max-width: 1100px;
  margin: 0 auto;
  padding: 30px 20px;
  line-height: 1.6;
  color: #222;
}

h1 {
  font-size: 36px;
}

h2 {
  margin-bottom: 8px;
}

.brand {
  border: 1px solid #ddd;
  padding: 20px;
  margin: 15px 0;
  border-radius: 12px;
}

a {
  color: #0645ad;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.logo {
  max-width: 180px;
  max-height: 120px;
  object-fit: contain;
}

</style>

</head>

<body>

${content}

</body>
</html>`;
}

/* =====================================================
   ROBOTS.TXT
   ===================================================== */

app.get(
  "/robots.txt",
  (req, res) => {

    res
      .type("text/plain")
      .send(
`User-agent: *
Allow: /

Disallow: /admin
Disallow: /api

Sitemap: ${SITE_URL}/sitemap.xml
`
      );
  }
);

/* =====================================================
   SITEMAP.XML
   ===================================================== */

app.get(
  "/sitemap.xml",
  (req, res) => {

    db.all(
      `
      SELECT
        id,
        created_at
      FROM brands
      ORDER BY id ASC
      `,
      [],
      (brandErr, brands) => {

        if (brandErr) {

          console.error(
            "Sitemap brands error:",
            brandErr
          );

          return res
            .status(500)
            .type("text/plain")
            .send("Sitemap error");
        }

        db.all(
          `
          SELECT
            id
          FROM countries
          ORDER BY id ASC
          `,
          [],
          (countryErr, countryRows) => {

            if (countryErr) {

              console.error(
                "Sitemap countries error:",
                countryErr
              );

              return res
                .status(500)
                .type("text/plain")
                .send("Sitemap error");
            }

            const urls = [];

            urls.push(`
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

            countryRows.forEach(country => {

              urls.push(`
  <url>
    <loc>${SITE_URL}/country/${country.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

            });

            brands.forEach(brand => {

              const lastmod =
                brand.created_at
                  ? new Date(brand.created_at)
                      .toISOString()
                      .split("T")[0]
                  : "";

              urls.push(`
  <url>
    <loc>${SITE_URL}/brand/${brand.id}</loc>
    ${
      lastmod
        ? `<lastmod>${lastmod}</lastmod>`
        : ""
    }
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);

            });

            const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;

            res
              .type("application/xml")
              .send(xml);
          }
        );
      }
    );
  }
);

/* =====================================================
   HEALTH
   ===================================================== */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      service: "ALL WORLD BRANDS",
      countries: countries.length
    });

  }
);

/* =====================================================
   COUNTRIES API
   ===================================================== */

app.get(
  "/api/countries",
  (req, res) => {

    db.all(
      `
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
      `,
      [],
      (err, rows) => {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        res.json(rows);
      }
    );
  }
);

/* =====================================================
   SINGLE COUNTRY API
   ===================================================== */

app.get(
  "/api/countries/:id",
  (req, res) => {

    db.get(
      `
      SELECT
        id,
        name,
        code
      FROM countries
      WHERE id = ?
      `,
      [req.params.id],
      (err, row) => {

        if (err) {

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        if (!row) {

          return res
            .status(404)
            .json({
              error: "Country not found"
            });
        }

        res.json(row);
      }
    );
  }
);

/* =====================================================
   COUNTRY BRANDS API
   ===================================================== */

app.get(
  "/api/countries/:id/brands",
  (req, res) => {

    db.all(
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
        c.id AS country_id,
        c.name AS country,
        c.code AS country_code
      FROM brands b
      JOIN countries c
        ON c.id = b.country_id
      WHERE b.country_id = ?
      ORDER BY b.name COLLATE NOCASE
      `,
      [req.params.id],
      (err, rows) => {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        res.json(rows);
      }
    );
  }
);

/* =====================================================
   BRAND API
   ===================================================== */

app.get(
  "/api/brands/:id",
  (req, res) => {

    db.get(
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
        c.id AS country_id,
        c.name AS country,
        c.code AS country_code
      FROM brands b
      JOIN countries c
        ON c.id = b.country_id
      WHERE b.id = ?
      `,
      [req.params.id],
      (err, row) => {

        if (err) {

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        if (!row) {

          return res
            .status(404)
            .json({
              error: "Brand not found"
            });
        }

        res.json(row);
      }
    );
  }
);

/* =====================================================
   SEARCH API
   ===================================================== */

app.get(
  "/api/search",
  (req, res) => {

    const q =
      String(req.query.q || "").trim();

    if (!q) {
      return res.json([]);
    }

    const like =
      `%${q}%`;

    db.all(
      `
      SELECT
        b.id,
        b.name,
        b.logo,
        b.category,
        b.description,
        b.website,
        b.verification,
        c.id AS country_id,
        c.name AS country,
        c.code AS country_code
      FROM brands b
      JOIN countries c
        ON c.id = b.country_id
      WHERE
        b.name LIKE ?
        OR b.description LIKE ?
        OR b.category LIKE ?
        OR c.name LIKE ?
      ORDER BY b.name COLLATE NOCASE
      LIMIT 100
      `,
      [
        like,
        like,
        like,
        like
      ],
      (err, rows) => {

        if (err) {

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        res.json(rows);
      }
    );
  }
);

/* =====================================================
   PUBLIC APPLICATION
   ===================================================== */

app.post(
  "/api/applications",
  (req, res) => {

    const {
      brand_name,
      country,
      owner_name,
      email,
      phone,
      website,
      logo,
      description
    } = req.body;

    if (
      !brand_name ||
      !email
    ) {

      return res
        .status(400)
        .json({
          ok: false,
          error:
            "Brand name and email are required"
        });
    }

    db.run(
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
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        brand_name.trim(),
        country || "",
        owner_name || "",
        email.trim(),
        phone || "",
        website || "",
        logo || "",
        description || ""
      ],
      function (err) {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              ok: false,
              error:
                "Could not save application"
            });
        }

        res.json({
          ok: true,
          id: this.lastID,
          message:
            "Application received. Payment is not processed automatically yet."
        });
      }
    );
  }
);

/* =====================================================
   ADMIN — APPLICATIONS
   ===================================================== */

app.get(
  "/api/admin/applications",
  adminAuth,
  (req, res) => {

    db.all(
      `
      SELECT
        id,
        brand_name,
        country,
        owner_name,
        owner_name AS owner_email,
        email,
        email AS applicant_email,
        phone,
        website,
        logo,
        description,
        status,
        created_at,
        'Basic' AS package
      FROM applications
      ORDER BY id DESC
      `,
      [],
      (err, rows) => {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        res.json(rows);
      }
    );
  }
);

/* =====================================================
   ADMIN — BRANDS
   ===================================================== */

app.get(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {

    db.all(
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
        c.id AS country_id,
        c.name AS country,
        c.code AS country_code
      FROM brands b
      JOIN countries c
        ON c.id = b.country_id
      ORDER BY b.id DESC
      `,
      [],
      (err, rows) => {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              error: "Database error"
            });
        }

        res.json(rows);
      }
    );
  }
);

/* =====================================================
   ADMIN — ADD BRAND
   ===================================================== */

app.post(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {

    const {
      country_id,
      country_code,
      name,
      logo,
      category,
      description,
      website,
      verification
    } = req.body;

    if (!name) {

      return res
        .status(400)
        .json({
          error:
            "Brand name is required"
        });
    }

    function createBrand(countryId) {

      if (!countryId) {

        return res
          .status(400)
          .json({
            error:
              "Valid country is required"
          });
      }

      db.run(
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
          name.trim(),
          logo || "",
          category || "",
          description || "",
          website || "",
          verification || "Unverified"
        ],
        function (err) {

          if (err) {

            console.error(err);

            return res
              .status(500)
              .json({
                error:
                  "Could not create brand"
              });
          }

          res.json({
            ok: true,
            id: this.lastID
          });
        }
      );
    }

    if (country_id) {
      return createBrand(country_id);
    }

    if (country_code) {

      db.get(
        `
        SELECT id
        FROM countries
        WHERE UPPER(code) = UPPER(?)
        `,
        [country_code],
        (err, row) => {

          if (err) {

            return res
              .status(500)
              .json({
                error:
                  "Database error"
              });
          }

          if (!row) {

            return res
              .status(400)
              .json({
                error:
                  "Country code not found"
              });
          }

          createBrand(row.id);
        }
      );

      return;
    }

    return res
      .status(400)
      .json({
        error:
          "Country or country code is required"
      });
  }
);

/* =====================================================
   ADMIN — UPDATE BRAND
   ===================================================== */

app.put(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {

    const {
      country_id,
      country_code,
      name,
      logo,
      category,
      description,
      website,
      verification
    } = req.body;

    function updateBrand(countryId) {

      if (!countryId || !name) {

        return res
          .status(400)
          .json({
            error:
              "Country and brand name are required"
          });
      }

      db.run(
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
          countryId,
          name.trim(),
          logo || "",
          category || "",
          description || "",
          website || "",
          verification || "Unverified",
          req.params.id
        ],
        function (err) {

          if (err) {

            console.error(err);

            return res
              .status(500)
              .json({
                error:
                  "Could not update brand"
              });
          }

          res.json({
            ok: true,
            changes: this.changes
          });
        }
      );
    }

    if (country_id) {
      return updateBrand(country_id);
    }

    if (country_code) {

      db.get(
        `
        SELECT id
        FROM countries
        WHERE UPPER(code) = UPPER(?)
        `,
        [country_code],
        (err, row) => {

          if (err) {

            return res
              .status(500)
              .json({
                error:
                  "Database error"
              });
          }

          if (!row) {

            return res
              .status(400)
              .json({
                error:
                  "Country code not found"
              });
          }

          updateBrand(row.id);
        }
      );

      return;
    }

    return res
      .status(400)
      .json({
        error:
          "Country is required"
      });
  }
);

/* =====================================================
   ADMIN — DELETE BRAND
   ===================================================== */

app.delete(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {

    db.run(
      `
      DELETE FROM brands
      WHERE id = ?
      `,
      [req.params.id],
      function (err) {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              error:
                "Could not delete brand"
            });
        }

        res.json({
          ok: true,
          changes: this.changes
        });
      }
    );
  }
);

/* =====================================================
   ADMIN — APPLICATION STATUS
   ===================================================== */

app.put(
  "/api/admin/applications/:id",
  adminAuth,
  (req, res) => {

    const { status } = req.body;

    const allowed = [
      "new",
      "reviewing",
      "approved",
      "rejected"
    ];

    if (!allowed.includes(status)) {

      return res
        .status(400)
        .json({
          error:
            "Invalid status"
        });
    }

    db.run(
      `
      UPDATE applications
      SET status = ?
      WHERE id = ?
      `,
      [
        status,
        req.params.id
      ],
      function (err) {

        if (err) {

          console.error(err);

          return res
            .status(500)
            .json({
              error:
                "Could not update application"
            });
        }

        res.json({
          ok: true,
          changes: this.changes
        });
      }
    );
  }
);

/* =====================================================
   SEO — COUNTRY PAGES
   ===================================================== */

app.get(
  "/country/:id",
  (req, res) => {

    db.get(
      `
      SELECT
        id,
        name,
        code
      FROM countries
      WHERE id = ?
      `,
      [req.params.id],
      (err, country) => {

        if (err) {
          return res
            .status(500)
            .send("Database error");
        }

        if (!country) {
          return res
            .status(404)
            .send("Country not found");
        }

        db.all(
          `
          SELECT
            id,
            name,
            category,
            description,
            website
          FROM brands
          WHERE country_id = ?
          ORDER BY name COLLATE NOCASE
          `,
          [country.id],
          (brandErr, brands) => {

            if (brandErr) {
              return res
                .status(500)
                .send("Database error");
            }

            const title =
              `${country.name} Brands | ALL WORLD BRANDS`;

            const description =
              `Discover brands from ${country.name}. Explore companies, brands, categories and official websites on ALL WORLD BRANDS.`;

            let content = `
              <h1>
                Brands in ${escapeHtml(country.name)}
              </h1>

              <p>
                Explore brands and companies from
                ${escapeHtml(country.name)}.
              </p>
            `;

            brands.forEach(brand => {

              content += `
                <div class="brand">

                  <h2>
                    <a href="/brand/${brand.id}">
                      ${escapeHtml(brand.name)}
                    </a>
                  </h2>

                  ${
                    brand.category
                      ? `
                        <p>
                          <strong>Category:</strong>
                          ${escapeHtml(brand.category)}
                        </p>
                      `
                      : ""
                  }

                  ${
                    brand.description
                      ? `
                        <p>
                          ${escapeHtml(
                            brand.description
                          )}
                        </p>
                      `
                      : ""
                  }

                  ${
                    brand.website
                      ? `
                        <p>
                          <a
                            href="${escapeHtml(
                              brand.website
                            )}"
                            rel="nofollow noopener"
                            target="_blank"
                          >
                            Official Website
                          </a>
                        </p>
                      `
                      : ""
                  }

                </div>
              `;

            });

            const schema = {
              "@context":
                "https://schema.org",
              "@type":
                "CollectionPage",
              "name":
                title,
              "description":
                description,
              "url":
                `${SITE_URL}/country/${country.id}`
            };

            res.send(
              seoPage({
                title,
                description,
                canonical:
                  `${SITE_URL}/country/${country.id}`,
                content,
                schema
              })
            );

          }
        );
      }
    );
  }
);

/* =====================================================
   SEO — BRAND PAGES
   ===================================================== */

app.get(
  "/brand/:id",
  (req, res) => {

    db.get(
      `
      SELECT
        b.id,
        b.name,
        b.logo,
        b.category,
        b.description,
        b.website,
        b.verification,
        c.name AS country,
        c.code AS country_code,
        c.id AS country_id
      FROM brands b
      JOIN countries c
        ON c.id = b.country_id
      WHERE b.id = ?
      `,
      [req.params.id],
      (err, brand) => {

        if (err) {
          return res
            .status(500)
            .send("Database error");
        }

        if (!brand) {
          return res
            .status(404)
            .send("Brand not found");
        }

        const title =
          `${brand.name} — ${brand.country} | ALL WORLD BRANDS`;

        const description =
          brand.description ||
          `${brand.name} is a brand from ${brand.country}. Discover information, category and official website on ALL WORLD BRANDS.`;

        let content = `
          <h1>
            ${escapeHtml(brand.name)}
          </h1>

          <p>
            <strong>Country:</strong>
            ${escapeHtml(brand.country)}
          </p>
        `;

        if (brand.category) {

          content += `
            <p>
              <strong>Category:</strong>
              ${escapeHtml(brand.category)}
            </p>
          `;

        }

        if (brand.logo) {

          content += `
            <p>
              <img
                class="logo"
                src="${escapeHtml(brand.logo)}"
                alt="${escapeHtml(
                  brand.name
                )} logo"
              >
            </p>
          `;

        }

        if (brand.description) {

          content += `
            <p>
              ${escapeHtml(
                brand.description
              )}
            </p>
          `;

        }

        if (brand.website) {

          content += `
            <p>
              <a
                href="${escapeHtml(
                  brand.website
                )}"
                target="_blank"
                rel="noopener"
              >
                Official Website
              </a>
            </p>
          `;

        }

        content += `
          <p>
            <a href="/country/${brand.country_id}">
              Browse brands from
              ${escapeHtml(brand.country)}
            </a>
          </p>
        `;

        const schema = {
          "@context":
            "https://schema.org",
          "@type":
            "Organization",
          "name":
            brand.name,
          "description":
            description,
          "url":
            brand.website ||
            `${SITE_URL}/brand/${brand.id}`,
          "mainEntityOfPage":
            `${SITE_URL}/brand/${brand.id}`,
          "address": {
            "@type":
              "PostalAddress",
            "addressCountry":
              brand.country_code
          }
        };

        res.send(
          seoPage({
            title,
            description,
            canonical:
              `${SITE_URL}/brand/${brand.id}`,
            content,
            schema
          })
        );

      }
    );
  }
);

/* =====================================================
   ADMIN PAGE
   ===================================================== */

app.get(
  "/admin",
  adminAuth,
  (req, res) => {

    res.setHeader(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive"
    );

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin",
        "admin.html"
      )
    );

  }
);

/* =====================================================
   ADMIN STATIC FILES
   ===================================================== */

app.use(
  "/admin",
  adminAuth,
  express.static(
    path.join(
      __dirname,
      "public",
      "admin"
    )
  )
);

/* =====================================================
   PUBLIC FILES
   ===================================================== */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =====================================================
   FALLBACK
   ===================================================== */

app.get(
  /.*/,
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

/* =====================================================
   START SERVER
   ===================================================== */

app.listen(
  PORT,
  () => {

    console.log(
      "================================="
    );

    console.log(
      "ALL WORLD BRANDS"
    );

    console.log(
      "Server running on port:",
      PORT
    );

    console.log(
      "World entries loaded:",
      countries.length
    );

    console.log(
      "Global SEO: ENABLED"
    );

    console.log(
      "Sitemap: ENABLED"
    );

    console.log(
      "Robots.txt: ENABLED"
    );

    console.log(
      "================================="
    );

  }
);
