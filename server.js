const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;

const SITE_URL = String(
  process.env.PUBLIC_BASE_URL ||
  "https://allworldbrands.net"
).replace(/\/+$/, "");

app.disable("x-powered-by");

/* =========================================================
   DATABASE
========================================================= */

const DB_FILE =
  process.env.DB_FILE ||
  path.join(__dirname, "allworldbrands.db");

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* =========================================================
   TABLES
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country_id INTEGER,
    category TEXT DEFAULT '',
    verification TEXT DEFAULT 'Unverified',
    description TEXT DEFAULT '',
    website TEXT DEFAULT '',
    logo TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(country_id)
      REFERENCES countries(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS factories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER,
    country_id INTEGER,
    description TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    website TEXT DEFAULT '',
    FOREIGN KEY(brand_id)
      REFERENCES brands(id)
      ON DELETE CASCADE,
    FOREIGN KEY(country_id)
      REFERENCES countries(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT,
    country TEXT,
    owner_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    logo TEXT,
    description TEXT,
    name TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new'
  );
`);

/* =========================================================
   SAFE MIGRATIONS
========================================================= */

function addColumnIfMissing(table, column, definition) {
  const exists = db
    .prepare(
      `SELECT 1
       FROM pragma_table_info(?)
       WHERE name = ?`
    )
    .get(table, column);

  if (!exists) {
    db.exec(
      `ALTER TABLE ${table}
       ADD COLUMN ${column} ${definition}`
    );
  }
}

const brandColumns = [
  ["category", "TEXT DEFAULT ''"],
  ["verification", "TEXT DEFAULT 'Unverified'"],
  ["description", "TEXT DEFAULT ''"],
  ["website", "TEXT DEFAULT ''"],
  ["logo", "TEXT DEFAULT ''"],
  ["created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"]
];

for (const [column, definition] of brandColumns) {
  addColumnIfMissing(
    "brands",
    column,
    definition
  );
}

const applicationColumns = [
  ["brand_name", "TEXT"],
  ["country", "TEXT"],
  ["owner_name", "TEXT"],
  ["email", "TEXT"],
  ["phone", "TEXT"],
  ["website", "TEXT"],
  ["logo", "TEXT"],
  ["description", "TEXT"],
  ["name", "TEXT"],
  ["message", "TEXT"],
  ["status", "TEXT DEFAULT 'new'"],
  ["created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"]
];

for (const [column, definition] of applicationColumns) {
  addColumnIfMissing(
    "applications",
    column,
    definition
  );
}

/* =========================================================
   PAYMENT FIELDS
========================================================= */

const paymentColumns = [
  ["payment_status", "TEXT DEFAULT 'unpaid'"],
  ["amount", "REAL DEFAULT 1"],
  ["currency", "TEXT DEFAULT 'USD'"],
  ["octo_transaction_id", "TEXT"],
  ["octo_payment_uuid", "TEXT"],
  ["paid_at", "DATETIME"]
];

for (const [column, definition] of paymentColumns) {
  addColumnIfMissing(
    "applications",
    column,
    definition
  );
}

/* =========================================================
   COUNTRY DATA
========================================================= */

const countryData = [
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
  ["British Virgin Islands", "VG"],
  ["Brunei", "BN"],
  ["Bulgaria", "BG"],
  ["Burkina Faso", "BF"],
  ["Burundi", "BI"],
  ["Cambodia", "KH"],
  ["Cameroon", "CM"],
  ["Canada", "CA"],
  ["Cape Verde", "CV"],
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
  ["Congo, Democratic Republic of the", "CD"],
  ["Cook Islands", "CK"],
  ["Costa Rica", "CR"],
  ["Croatia", "HR"],
  ["Cuba", "CU"],
  ["Curaçao", "CW"],
  ["Cyprus", "CY"],
  ["Czech Republic", "CZ"],
  ["Côte d’Ivoire", "CI"],
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
  ["Pitcairn Islands", "PN"],
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
  ["Saint Martin", "MF"],
  ["Saint Pierre and Miquelon", "PM"],
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
  ["U.S. Virgin Islands", "VI"],
  ["Uganda", "UG"],
  ["Ukraine", "UA"],
  ["United Arab Emirates", "AE"],
  ["United Kingdom", "GB"],
  ["United States", "US"],
  ["United States Minor Outlying Islands", "UM"],
  ["Uruguay", "UY"],
  ["Uzbekistan", "UZ"],
  ["Vanuatu", "VU"],
  ["Vatican City", "VA"],
  ["Venezuela", "VE"],
  ["Vietnam", "VN"],
  ["Wallis and Futuna", "WF"],
  ["Western Sahara", "EH"],
  ["Yemen", "YE"],
  ["Zambia", "ZM"],
  ["Zimbabwe", "ZW"],
  ["Åland Islands", "AX"]
];

const countryCodes = new Map(countryData);

const insertCountry = db.prepare(
  `INSERT OR IGNORE INTO countries (name) VALUES (?)`
);

const insertCountries = db.transaction(() => {
  for (const [name] of countryData) {
    insertCountry.run(name);
  }
});

insertCountries();

/* =========================================================
   STARTER BRANDS
========================================================= */

const starterBrands = [
  ["Apple", "United States"],
  ["Nike", "United States"],
  ["Burberry", "United Kingdom"],
  ["BMW", "Germany"],
  ["L'Oréal", "France"],
  ["Ferrari", "Italy"],
  ["Arçelik", "Turkey"],
  ["Artel", "Uzbekistan"],
  ["Toyota", "Japan"],
  ["Samsung", "South Korea"],
  ["Huawei", "China"],
  ["Tata", "India"]
];

const findCountry = db.prepare(
  `SELECT id FROM countries WHERE name = ?`
);

const insertBrand = db.prepare(`
  INSERT INTO brands
  (name, country_id)
  VALUES (?, ?)
`);

for (const [brandName, countryName] of starterBrands) {
  const country = findCountry.get(countryName);

  if (!country) continue;

  const exists = db
    .prepare(
      `SELECT id FROM brands WHERE name = ?`
    )
    .get(brandName);

  if (!exists) {
    insertBrand.run(
      brandName,
      country.id
    );
  }
}

/* =========================================================
   HELPERS
========================================================= */

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/[&<>"]/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;"
    }[char]));
}

function normalizeText(value, max = 5000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 320);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSafeUrl(value) {
  const url = String(value ?? "").trim();

  if (!url) return true;

  if (url.length > 2048) return false;

  if (
    /^(javascript|data|vbscript|file|blob):/i.test(url)
  ) {
    return false;
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
   MODERATION
========================================================= */

const ADULT_CONTENT_WORDS = [
  "porn",
  "porno",
  "pornography",
  "pornographic",
  "xxx",
  "nsfw",
  "sex video",
  "sex videos",
  "adult video",
  "adult videos",
  "nude",
  "nudity",
  "explicit sex"
];

function normalizeForModeration(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAdultContent(value) {
  const text =
    normalizeForModeration(value);

  return ADULT_CONTENT_WORDS.some(word =>
    text.includes(
      normalizeForModeration(word)
    )
  );
}

function isBlockedContent(...values) {
  return values.some(value =>
    containsAdultContent(value)
  );
}

/* =========================================================
   OLD DOMAIN REDIRECT
========================================================= */

app.use((req, res, next) => {
  const host = String(
    req.headers.host || ""
  )
    .toLowerCase()
    .split(":")[0];

  if (
    host === "dbrands.net" ||
    host === "www.dbrands.net"
  ) {
    return res.redirect(
      301,
      SITE_URL + req.originalUrl
    );
  }

  next();
});

/* =========================================================
   ROBOTS
========================================================= */

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${SITE_URL}/sitemap.xml
`
  );
});

/* =========================================================
   SITEMAP
========================================================= */

app.get("/sitemap.xml", (req, res) => {
  const countries = db
    .prepare(
      `SELECT id
       FROM countries
       ORDER BY id`
    )
    .all();

  const brands = db
    .prepare(
      `SELECT id
       FROM brands
       ORDER BY id`
    )
    .all();

  let urls =
    `<url>` +
    `<loc>${SITE_URL}/</loc>` +
    `<changefreq>daily</changefreq>` +
    `<priority>1.0</priority>` +
    `</url>`;

  for (const country of countries) {
    urls +=
      `<url>` +
      `<loc>${SITE_URL}/country/${country.id}</loc>` +
      `<changefreq>weekly</changefreq>` +
      `<priority>0.8</priority>` +
      `</url>`;
  }

  for (const brand of brands) {
    urls +=
      `<url>` +
      `<loc>${SITE_URL}/brand/${brand.id}</loc>` +
      `<changefreq>weekly</changefreq>` +
      `<priority>0.7</priority>` +
      `</url>`;
  }

  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      urls +
      `</urlset>`
    );
});

/* =========================================================
   SEO COUNTRY PAGE
========================================================= */

app.get("/country/:id", (req, res) => {
  const country = db
    .prepare(
      `SELECT *
       FROM countries
       WHERE id = ?`
    )
    .get(req.params.id);

  if (!country) {
    return res
      .status(404)
      .send("Country not found.");
  }

  const brands = db
    .prepare(`
      SELECT
        id,
        name,
        description,
        website
      FROM brands
      WHERE country_id = ?
      ORDER BY name COLLATE NOCASE
    `)
    .all(req.params.id);

  const items = brands
    .map(
      brand =>
        `<li>` +
        `<a href="/brand/${brand.id}">` +
        `${htmlEscape(brand.name)}` +
        `</a>` +
        `</li>`
    )
    .join("");

  const title =
    `${country.name} Brands | ALL WORLD BRANDS`;

  const description =
    `Discover brands and companies from ` +
    `${country.name} on ALL WORLD BRANDS.`;

  res.send(`
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>${htmlEscape(title)}</title>

<meta name="description"
      content="${htmlEscape(description)}">

<meta name="robots"
      content="index,follow">

<link rel="canonical"
      href="${SITE_URL}/country/${country.id}">

<meta property="og:title"
      content="${htmlEscape(title)}">

<meta property="og:description"
      content="${htmlEscape(description)}">

<meta property="og:url"
      content="${SITE_URL}/country/${country.id}">
</head>

<body>
<main>

<h1>${htmlEscape(country.name)}</h1>

<p>${htmlEscape(description)}</p>

${
  items
    ? `<h2>Brands</h2><ul>${items}</ul>`
    : `<p>No brands listed yet.</p>`
}

<p>
<a href="/">
← ALL WORLD BRANDS
</a>
</p>

</main>
</body>
</html>
`);
});

/* =========================================================
   SEO BRAND PAGE
========================================================= */

app.get("/brand/:id", (req, res) => {
  const brand = db
    .prepare(`
      SELECT
        brands.*,
        countries.name AS country_name,
        countries.id AS country_id
      FROM brands
      LEFT JOIN countries
        ON brands.country_id = countries.id
      WHERE brands.id = ?
    `)
    .get(req.params.id);

  if (!brand) {
    return res
      .status(404)
      .send("Brand not found.");
  }

  const title =
    `${brand.name} | ALL WORLD BRANDS`;

  const description =
    `${brand.name} brand profile from ` +
    `${brand.country_name || "the world"}.`;

  const url =
    `${SITE_URL}/brand/${brand.id}`;

  const website =
    isSafeUrl(brand.website)
      ? brand.website
      : "";

  res.send(`
<!doctype html>
<html lang="en">
<head>

<meta charset="utf-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>${htmlEscape(title)}</title>

<meta name="description"
      content="${htmlEscape(description)}">

<meta name="robots"
      content="index,follow">

<link rel="canonical"
      href="${htmlEscape(url)}">

<meta property="og:title"
      content="${htmlEscape(title)}">

<meta property="og:description"
      content="${htmlEscape(description)}">

<meta property="og:url"
      content="${htmlEscape(url)}">

</head>

<body>

<main>

<h1>${htmlEscape(brand.name)}</h1>

<p>
<strong>Country:</strong>
<a href="/country/${brand.country_id}">
${htmlEscape(brand.country_name || "")}
</a>
</p>

<p>
${htmlEscape(
  brand.description ||
  "Brand profile on ALL WORLD BRANDS."
)}
</p>

${
  website
    ? `
<p>
<a
  href="${htmlEscape(website)}"
  target="_blank"
  rel="noopener noreferrer"
>
Official website
</a>
</p>
`
    : ""
}

<p>
<a href="/">
← ALL WORLD BRANDS
</a>
</p>

</main>

</body>
</html>
`);
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  morgan("combined")
);

app.use(
  express.json({
    limit: "30kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "30kb"
  })
);

/* =========================================================
   ADMIN AUTH
========================================================= */

const ADMIN_USER =
  process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

function adminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res
      .status(500)
      .send(
        "Admin password is not configured."
      );
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

  const encoded =
    auth.substring(6);

  let decoded;

  try {
    decoded =
      Buffer
        .from(encoded, "base64")
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
      .send(
        "Wrong username or password."
      );
  }

  next();
}

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
  "/admin",
  adminAuth,
  (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store"
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

app.get(
  "/admin/",
  adminAuth,
  (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store"
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

app.get(
  "/admin/admin.html",
  adminAuth,
  (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store"
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

app.use(
  "/admin",
  adminAuth,
  express.static(
    path.join(
      __dirname,
      "public",
      "admin"
    ),
    {
      index: false
    }
  )
);

/* =========================================================
   PUBLIC STATIC
========================================================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "ALL WORLD BRANDS",
      directoryEntries:
        countryCodes.size
    });
  }
);

/* =========================================================
   SITE CONFIG
========================================================= */

app.get(
  "/api/site-config",
  (req, res) => {
    res.json({
      ok: true,
      site_name: "ALL WORLD BRANDS",
      site_url: SITE_URL,
      contact_email:
        process.env.CONTACT_EMAIL || "",
      contact_phone:
        process.env.CONTACT_PHONE || "",
      contact_whatsapp:
        process.env.CONTACT_WHATSAPP || "",
      contact_telegram:
        process.env.CONTACT_TELEGRAM || ""
    });
  }
);

/* =========================================================
   COUNTRIES
========================================================= */

app.get(
  "/api/countries",
  (req, res) => {
    const rows = db
      .prepare(`
        SELECT *
        FROM countries
        ORDER BY name COLLATE NOCASE
      `)
      .all();

    res.json(
      rows.map(row => ({
        ...row,
        code:
          countryCodes.get(
            row.name
          ) || null,
        flag_code:
          countryCodes.get(
            row.name
          ) || null
      }))
    );
  }
);

/* =========================================================
   BRANDS BY COUNTRY
========================================================= */

app.get(
  "/api/countries/:id/brands",
  (req, res) => {
    const rows = db
      .prepare(`
        SELECT
          brands.*,
          countries.name AS country_name
        FROM brands
        LEFT JOIN countries
          ON brands.country_id =
             countries.id
        WHERE brands.country_id = ?
        ORDER BY brands.name COLLATE NOCASE
      `)
      .all(req.params.id);

    res.json(
      rows.map(row => ({
        ...row,
        country_code:
          countryCodes.get(
            row.country_name
          ) || null
      }))
    );
  }
);

/* =========================================================
   BRAND DETAILS
========================================================= */

app.get(
  "/api/brands/:id",
  (req, res) => {
    const brand = db
      .prepare(`
        SELECT
          brands.*,
          countries.name AS country_name
        FROM brands
        LEFT JOIN countries
          ON brands.country_id =
             countries.id
        WHERE brands.id = ?
      `)
      .get(req.params.id);

    if (!brand) {
      return res
        .status(404)
        .json({
          error: "Brand not found"
        });
    }

    brand.country_code =
      countryCodes.get(
        brand.country_name
      ) || null;

    brand.factories =
      db
        .prepare(`
          SELECT *
          FROM factories
          WHERE brand_id = ?
          ORDER BY name COLLATE NOCASE
        `)
        .all(brand.id);

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
      String(
        req.query.q || ""
      ).trim();

    if (!q) {
      return res.json([]);
    }

    const search =
      `%${q}%`;

    const rows = db
      .prepare(`
        SELECT
          brands.id,
          brands.name,
          brands.category,
          brands.verification,
          brands.description,
          brands.website,
          brands.logo,
          countries.name AS country_name
        FROM brands
        LEFT JOIN countries
          ON brands.country_id =
             countries.id
        WHERE
          brands.name LIKE ?
          OR brands.category LIKE ?
          OR brands.description LIKE ?
          OR countries.name LIKE ?
        ORDER BY brands.name COLLATE NOCASE
        LIMIT 100
      `)
      .all(
        search,
        search,
        search,
        search
      );

    res.json(
      rows.map(row => ({
        ...row,
        country_code:
          countryCodes.get(
            row.country_name
          ) || null
      }))
    );
  }
);

/* =========================================================
   PUBLIC BRAND APPLICATION
========================================================= */

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

    const brandName =
      normalizeText(
        brand_name,
        200
      );

    const countryName =
      normalizeText(
        country,
        200
      );

    const ownerName =
      normalizeText(
        owner_name,
        200
      );

    const normalizedEmail =
      normalizeEmail(email);

    const phoneValue =
      normalizeText(
        phone,
        80
      );

    const websiteValue =
      normalizeText(
        website,
        500
      );

    const logoValue =
      normalizeText(
        logo,
        500
      );

    const descriptionValue =
      normalizeText(
        description,
        3000
      );

    if (
      !brandName ||
      !countryName ||
      !ownerName ||
      !normalizedEmail
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Brand, country, name and email are required."
      });
    }

    if (
      !isValidEmail(
        normalizedEmail
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid email address."
      });
    }

    if (
      !isSafeUrl(
        websiteValue
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid website URL."
      });
    }

    if (
      !isSafeUrl(
        logoValue
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid logo URL."
      });
    }

    if (
      isBlockedContent(
        brandName,
        countryName,
        ownerName,
        websiteValue,
        descriptionValue
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Content is not allowed."
      });
    }

    const countryExists =
      db
        .prepare(`
          SELECT id
          FROM countries
          WHERE name = ?
        `)
        .get(countryName);

    if (!countryExists) {
      return res.status(400).json({
        ok: false,
        error:
          "Country not found."
      });
    }

    const amount =
      Number(
        process.env.OCTO_AMOUNT || 1
      );

    const currency =
      String(
        process.env.OCTO_CURRENCY ||
        "USD"
      ).toUpperCase();

    const result =
      db
        .prepare(`
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
            payment_status,
            amount,
            currency,
            status
          )
          VALUES (
            ?,?,?,?,?,?,?,?,
            'unpaid',?,?, 'new'
          )
        `)
        .run(
          brandName,
          countryName,
          ownerName,
          normalizedEmail,
          phoneValue,
          websiteValue,
          logoValue,
          descriptionValue,
          amount,
          currency
        );

    res.json({
      ok: true,
      id:
        Number(
          result.lastInsertRowid
        ),
      payment_status:
        "unpaid"
    });
  }
);

/* =========================================================
   OCTO CONFIGURATION
========================================================= */

const OCTO_SHOP_ID =
  Number(
    process.env.OCTO_SHOP_ID ||
    43051
  );

const OCTO_SECRET =
  process.env.OCTO_SECRET || "";

const OCTO_API_URL =
  "https://secure.octo.uz/prepare_payment";

const OCTO_AMOUNT =
  Number(
    process.env.OCTO_AMOUNT || 1
  );

const OCTO_CURRENCY =
  String(
    process.env.OCTO_CURRENCY ||
    "USD"
  ).toUpperCase();

const OCTO_TEST =
  String(
    process.env.OCTO_TEST ||
    "false"
  ).toLowerCase() === "true";

const OCTO_LANGUAGE =
  process.env.OCTO_LANGUAGE ||
  "uz";

const OCTO_TTL_MINUTES =
  Number(
    process.env.OCTO_TTL_MINUTES ||
    15
  );

/* =========================================================
   BASE URL
========================================================= */

function getBaseUrl(req) {

  if (
    process.env.PUBLIC_BASE_URL
  ) {
    return String(
      process.env.PUBLIC_BASE_URL
    ).replace(
      /\/+$/,
      ""
    );
  }

  const proto =
    req.headers[
      "x-forwarded-proto"
    ] ||
    (
      req.secure
        ? "https"
        : "http"
    );

  return (
    `${proto}://${req.get("host")}`
  );
}

/* =========================================================
   OCTO TIME
========================================================= */

function octoInitTime() {
  const d = new Date();

  const pad =
    number =>
      String(number)
        .padStart(2, "0");

  return (
    `${d.getUTCFullYear()}-` +
    `${pad(d.getUTCMonth() + 1)}-` +
    `${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:` +
    `${pad(d.getUTCMinutes())}:` +
    `${pad(d.getUTCSeconds())}`
  );
}

/* =========================================================
   OCTO PREPARE
========================================================= */

async function octoPrepare(payload) {

  const response =
    await fetch(
      OCTO_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          "Accept":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      `OCTO returned invalid JSON (${response.status})`
    );
  }

  if (
    !response.ok ||
    Number(
      data.error || 0
    ) !== 0
  ) {
    throw new Error(
      data.errMessage ||
      data.errorMessage ||
      `OCTO error ${
        data.error ||
        response.status
      }`
    );
  }

  return data;
}

/* =========================================================
   OCTO CREATE PAYMENT
========================================================= */

app.post(
  "/api/payments/octo/create",
  async (req, res) => {

    if (!OCTO_SECRET) {
      return res.status(503).json({
        ok: false,
        error:
          "OCTO_SECRET is not configured in Render."
      });
    }

    const {
      brand_name,
      country,
      owner_name,
      email,
      phone,
      website,
      description,
      logo
    } = req.body;

    const brandName =
      normalizeText(
        brand_name,
        200
      );

    const countryName =
      normalizeText(
        country,
        200
      );

    const ownerName =
      normalizeText(
        owner_name,
        200
      );

    const normalizedEmail =
      normalizeEmail(email);

    const phoneValue =
      normalizeText(
        phone,
        80
      );

    const websiteValue =
      normalizeText(
        website,
        500
      );

    const logoValue =
      normalizeText(
        logo,
        500
      );

    const descriptionValue =
      normalizeText(
        description,
        3000
      );

    if (
      !brandName ||
      !countryName ||
      !ownerName ||
      !normalizedEmail
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Brand, country, name and email are required."
      });
    }

    if (
      !isValidEmail(
        normalizedEmail
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid email address."
      });
    }

    if (
      !isSafeUrl(
        websiteValue
      ) ||
      !isSafeUrl(
        logoValue
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid URL."
      });
    }

    if (
      isBlockedContent(
        brandName,
        countryName,
        ownerName,
        websiteValue,
        descriptionValue
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Content is not allowed."
      });
    }

    const countryExists =
      db
        .prepare(`
          SELECT id
          FROM countries
          WHERE name = ?
        `)
        .get(countryName);

    if (!countryExists) {
      return res.status(400).json({
        ok: false,
        error:
          "Country not found."
      });
    }

    const application =
      db
        .prepare(`
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
            payment_status,
            amount,
            currency,
            status
          )
          VALUES (
            ?,?,?,?,?,?,?,?,
            'unpaid',?,?, 'new'
          )
        `)
        .run(
          brandName,
          countryName,
          ownerName,
          normalizedEmail,
          phoneValue,
          websiteValue,
          logoValue,
          descriptionValue,
          OCTO_AMOUNT,
          OCTO_CURRENCY
        );

    const applicationId =
      Number(
        application.lastInsertRowid
      );

    const transactionId =
      `AWB-${applicationId}-` +
      `${Date.now()}-` +
      `${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    try {

      const baseUrl =
        getBaseUrl(req);

      const octo =
        await octoPrepare({

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
            octoInitTime(),

          user_data: {
            user_id:
              String(
                applicationId
              ),

            phone:
              phoneValue,

            email:
              normalizedEmail
          },

          total_sum:
            OCTO_AMOUNT,

          currency:
            OCTO_CURRENCY,

          description:
            `ALL WORLD BRANDS - ${brandName}`
              .slice(0, 200),

          basket: [
            {
              position_desc:
                `Brand listing - ${brandName}`
                  .slice(0, 200),

              count: 1,

              price:
                OCTO_AMOUNT
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
            `${baseUrl}/?payment=octo` +
            `&application_id=${applicationId}`,

          notify_url:
            `${baseUrl}/api/octo/notify`,

          language:
            OCTO_LANGUAGE,

          ttl:
            OCTO_TTL_MINUTES
        });

      const data =
        octo.data || octo;

      const paymentUuid =
        data.octo_payment_UUID ||
        data.octo_payment_uuid ||
        null;

      const payUrl =
        data.octo_pay_url ||
        data.payment_url ||
        null;

      if (!payUrl) {
        throw new Error(
          "OCTO did not return octo_pay_url."
        );
      }

      db
        .prepare(`
          UPDATE applications
          SET
            octo_transaction_id = ?,
            octo_payment_uuid = ?
          WHERE id = ?
        `)
        .run(
          transactionId,
          paymentUuid,
          applicationId
        );

      return res.json({
        ok: true,
        application_id:
          applicationId,
        payment_status:
          "unpaid",
        pay_url:
          payUrl
      });

    } catch (error) {

      console.error(
        "OCTO create error:",
        error
      );

      db
        .prepare(`
          UPDATE applications
          SET status = 'payment_error'
          WHERE id = ?
        `)
        .run(
          applicationId
        );

      return res.status(502).json({
        ok: false,
        error:
          "OCTO payment could not be created."
      });
    }
  }
);

/* =========================================================
   OCTO STATUS HELPERS
========================================================= */

function extractOctoStatus(data) {
  return String(
    data?.status ||
    data?.payment_status ||
    data?.paymentStatus ||
    ""
  ).toLowerCase();
}

/*
  OCTO may return the amount under different fields.
  If the status response does not contain an amount,
  return null instead of 0.
*/
function extractOctoAmount(data) {
  const value =
    data?.total_sum ??
    data?.transfer_sum ??
    data?.amount ??
    data?.paid_amount;

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function extractOctoCurrency(data) {
  return String(
    data?.currency ||
    data?.currency_code ||
    ""
  ).toUpperCase();
}

function isOctoPaid(status) {
  return [
    "succeeded",
    "success",
    "paid",
    "captured",
    "completed"
  ].includes(
    String(status).toLowerCase()
  );
}

function isOctoFailed(status) {
  return [
    "failed",
    "failure",
    "cancelled",
    "canceled",
    "expired",
    "rejected"
  ].includes(
    String(status).toLowerCase()
  );
}

function moneyEquals(a, b) {
  return (
    Math.abs(
      Number(a) -
      Number(b)
    ) < 0.01
  );
}

/* =========================================================
   REAL OCTO VERIFICATION
========================================================= */

async function verifyOctoApplication(
  applicationId
) {

  const application =
    db
      .prepare(`
        SELECT *
        FROM applications
        WHERE id = ?
      `)
      .get(
        applicationId
      );

  if (!application) {
    throw new Error(
      "Application not found."
    );
  }

  if (
    !application.octo_transaction_id
  ) {
    throw new Error(
      "OCTO transaction ID is missing."
    );
  }

  const octo =
    await octoPrepare({
      octo_shop_id:
        OCTO_SHOP_ID,

      octo_secret:
        OCTO_SECRET,

      shop_transaction_id:
        application.octo_transaction_id
    });

  const data =
    octo.data || octo;

  const status =
    extractOctoStatus(
      data
    );

  const total =
    extractOctoAmount(
      data
    );

  const returnedCurrency =
    extractOctoCurrency(
      data
    );

  const expected =
    Number(
      application.amount ||
      OCTO_AMOUNT
    );

  const expectedCurrency =
    String(
      application.currency ||
      OCTO_CURRENCY
    ).toUpperCase();

  const successful =
    isOctoPaid(status);

  /*
    If OCTO returns an amount, compare it.
    If OCTO does not return an amount in the
    status response, do not convert it to 0
    and falsely reject a successful payment.
  */
  const amountMatches =
    total === null
      ? true
      : moneyEquals(
          total,
          expected
        );

  const currencyMatches =
    !returnedCurrency ||
    returnedCurrency ===
      expectedCurrency;

  if (
    successful &&
    amountMatches &&
    currencyMatches
  ) {

    db
      .prepare(`
        UPDATE applications
        SET
          payment_status = 'paid',
          paid_at =
            COALESCE(
              paid_at,
              CURRENT_TIMESTAMP
            )
        WHERE id = ?
      `)
      .run(
        applicationId
      );

  } else if (
    isOctoFailed(status)
  ) {

    db
      .prepare(`
        UPDATE applications
        SET
          payment_status = 'failed'
        WHERE id = ?
      `)
      .run(
        applicationId
      );
  }

  const fresh =
    db
      .prepare(`
        SELECT
          payment_status,
          amount,
          currency,
          octo_transaction_id,
          octo_payment_uuid,
          paid_at
        FROM applications
        WHERE id = ?
      `)
      .get(
        applicationId
      );

  return {
    application_id:
      Number(applicationId),

    payment_status:
      fresh?.payment_status ||
      "unpaid",

    octo_status:
      status ||
      "unknown",

    amount:
      total,

    expected_amount:
      expected,

    currency:
      expectedCurrency,

    returned_currency:
      returnedCurrency ||
      null,

    amount_matches:
      amountMatches,

    currency_matches:
      currencyMatches,

    paid_at:
      fresh?.paid_at ||
      null
  };
}

/* =========================================================
   OCTO STATUS ENDPOINT
========================================================= */

app.get(
  "/api/payments/octo/status/:applicationId",
  async (req, res) => {

    if (!OCTO_SECRET) {
      return res.status(503).json({
        ok: false,
        error:
          "OCTO_SECRET is not configured."
      });
    }

    try {

      const result =
        await verifyOctoApplication(
          req.params.applicationId
        );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      res.json({
        ok: true,
        ...result
      });

    } catch (error) {

      console.error(
        "OCTO status error:",
        error
      );

      res.status(502).json({
        ok: false,
        error:
          "Could not verify OCTO payment."
      });
    }
  }
);

/* =========================================================
   OCTO CALLBACK
========================================================= */

app.post(
  "/api/octo/notify",
  async (req, res) => {

    const uuid =
      req.body.octo_payment_UUID ||
      req.body.octo_payment_uuid ||
      "";

    const transactionId =
      req.body.shop_transaction_id ||
      req.body.shopTransactionId ||
      "";

    let application = null;

    if (uuid) {
      application =
        db
          .prepare(`
            SELECT id
            FROM applications
            WHERE octo_payment_uuid = ?
          `)
          .get(uuid);
    }

    if (
      !application &&
      transactionId
    ) {
      application =
        db
          .prepare(`
            SELECT id
            FROM applications
            WHERE octo_transaction_id = ?
          `)
          .get(transactionId);
    }

    if (!application) {
      return res.json({
        accept_status:
          "cancel"
      });
    }

    try {

      const result =
        await verifyOctoApplication(
          application.id
        );

      return res.json({
        accept_status:
          result.payment_status ===
          "paid"
            ? "capture"
            : "cancel",

        final_amount:
          Number(
            result.expected_amount
          )
      });

    } catch (error) {

      console.error(
        "OCTO notify verification:",
        error
      );

      return res.json({
        accept_status:
          "cancel"
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
  (req, res) => {

    const rows =
      db
        .prepare(`
          SELECT
            brands.*,
            countries.name AS country_name
          FROM brands
          LEFT JOIN countries
            ON brands.country_id =
               countries.id
          ORDER BY brands.id DESC
        `)
        .all();

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    res.json(rows);
  }
);

/* =========================================================
   ADMIN CREATE BRAND
========================================================= */

app.post(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {

    const {
      name,
      country_id,
      category,
      verification,
      description,
      website,
      logo
    } = req.body;

    const brandName =
      normalizeText(
        name,
        200
      );

    if (!brandName) {
      return res.status(400).json({
        error:
          "Brand name is required."
      });
    }

    if (
      isBlockedContent(
        brandName,
        category,
        description
      )
    ) {
      return res.status(400).json({
        error:
          "Content is not allowed."
      });
    }

    const countryId =
      country_id
        ? Number(country_id)
        : null;

    if (countryId) {
      const country =
        db
          .prepare(`
            SELECT id
            FROM countries
            WHERE id = ?
          `)
          .get(countryId);

      if (!country) {
        return res.status(400).json({
          error:
            "Country not found."
        });
      }
    }

    const websiteValue =
      normalizeText(
        website,
        500
      );

    const logoValue =
      normalizeText(
        logo,
        500
      );

    if (
      !isSafeUrl(
        websiteValue
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid website URL."
      });
    }

    if (
      !isSafeUrl(
        logoValue
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid logo URL."
      });
    }

    const result =
      db
        .prepare(`
          INSERT INTO brands
          (
            name,
            country_id,
            category,
            verification,
            description,
            website,
            logo
          )
          VALUES (
            ?,?,?,?,?,?,?
          )
        `)
        .run(
          brandName,
          countryId,
          normalizeText(
            category,
            200
          ),
          normalizeText(
            verification ||
            "Unverified",
            100
          ),
          normalizeText(
            description,
            3000
          ),
          websiteValue,
          logoValue
        );

    res.json({
      success: true,
      id:
        Number(
          result.lastInsertRowid
        )
    });
  }
);

/* =========================================================
   ADMIN UPDATE BRAND
========================================================= */

app.patch(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {

    const existing =
      db
        .prepare(`
          SELECT id
          FROM brands
          WHERE id = ?
        `)
        .get(
          req.params.id
        );

    if (!existing) {
      return res.status(404).json({
        error:
          "Brand not found."
      });
    }

    const {
      name,
      country_id,
      category,
      verification,
      description,
      website,
      logo
    } = req.body;

    const brandName =
      normalizeText(
        name,
        200
      );

    if (!brandName) {
      return res.status(400).json({
        error:
          "Brand name is required."
      });
    }

    const countryId =
      country_id
        ? Number(country_id)
        : null;

    if (countryId) {
      const country =
        db
          .prepare(`
            SELECT id
            FROM countries
            WHERE id = ?
          `)
          .get(countryId);

      if (!country) {
        return res.status(400).json({
          error:
            "Country not found."
        });
      }
    }

    const websiteValue =
      normalizeText(
        website,
        500
      );

    const logoValue =
      normalizeText(
        logo,
        500
      );

    if (
      !isSafeUrl(
        websiteValue
      ) ||
      !isSafeUrl(
        logoValue
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid URL."
      });
    }

    if (
      isBlockedContent(
        brandName,
        category,
        description
      )
    ) {
      return res.status(400).json({
        error:
          "Content is not allowed."
      });
    }

    const result =
      db
        .prepare(`
          UPDATE brands
          SET
            name = ?,
            country_id = ?,
            category = ?,
            verification = ?,
            description = ?,
            website = ?,
            logo = ?
          WHERE id = ?
        `)
        .run(
          brandName,
          countryId,
          normalizeText(
            category,
            200
          ),
          normalizeText(
            verification ||
            "Unverified",
            100
          ),
          normalizeText(
            description,
            3000
          ),
          websiteValue,
          logoValue,
          req.params.id
        );

    res.json({
      success: true,
      changes:
        result.changes
    });
  }
);

/* =========================================================
   ADMIN DELETE BRAND
========================================================= */

app.delete(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {

    const result =
      db
        .prepare(`
          DELETE FROM brands
          WHERE id = ?
        `)
        .run(
          req.params.id
        );

    res.json({
      success: true,
      changes:
        result.changes
    });
  }
);

/* =========================================================
   ADMIN APPLICATIONS
========================================================= */

app.get(
  "/api/admin/applications",
  adminAuth,
  (req, res) => {

    const rows =
      db
        .prepare(`
          SELECT
            id,
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
            amount,
            currency,
            octo_transaction_id,
            octo_payment_uuid,
            paid_at,
            created_at
          FROM applications
          ORDER BY id DESC
        `)
        .all();

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    res.json(rows);
  }
);

/* =========================================================
   ADMIN APPLICATION STATUS
========================================================= */

app.patch(
  "/api/admin/applications/:id",
  adminAuth,
  (req, res) => {

    const allowed = [
      "new",
      "approved",
      "rejected"
    ];

    const status =
      String(
        req.body.status || ""
      );

    if (
      !allowed.includes(
        status
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid status"
      });
    }

    const result =
      db
        .prepare(`
          UPDATE applications
          SET status = ?
          WHERE id = ?
        `)
        .run(
          status,
          req.params.id
        );

    res.json({
      success: true,
      changes:
        result.changes
    });
  }
);

/* =========================================================
   ADMIN VERIFY PAYMENT
========================================================= */

app.post(
  "/api/admin/applications/:id/verify-payment",
  adminAuth,
  async (req, res) => {

    if (!OCTO_SECRET) {
      return res.status(503).json({
        ok: false,
        error:
          "OCTO_SECRET is not configured."
      });
    }

    try {

      const result =
        await verifyOctoApplication(
          req.params.id
        );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      res.json({
        ok: true,
        ...result
      });

    } catch (error) {

      console.error(
        "Admin payment verification:",
        error
      );

      res.status(502).json({
        ok: false,
        error:
          "Could not verify payment."
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
  (req, res) => {

    const result =
      db
        .prepare(`
          DELETE FROM applications
          WHERE id = ?
        `)
        .run(
          req.params.id
        );

    res.json({
      success: true,
      changes:
        result.changes
    });
  }
);

/* =========================================================
   ADMIN COUNTRIES
========================================================= */

app.get(
  "/api/admin/countries",
  adminAuth,
  (req, res) => {

    const rows =
      db
        .prepare(`
          SELECT *
          FROM countries
          ORDER BY name COLLATE NOCASE
        `)
        .all();

    res.json(
      rows.map(row => ({
        ...row,
        code:
          countryCodes.get(
            row.name
          ) || null
      }))
    );
  }
);

/* =========================================================
   PUBLIC FALLBACK
========================================================= */

app.get(
  /.*/,
  (req, res, next) => {

    if (
      req.path.startsWith(
        "/api/"
      ) ||
      req.path.startsWith(
        "/admin"
      )
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
    res
      .status(404)
      .send("Not found.");
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    res
      .status(500)
      .json({
        ok: false,
        error:
          "Server error"
      });
  }
);

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(signal) {

  console.log(
    `${signal} received. Shutting down...`
  );

  try {
    db.close();
  } catch (error) {
    console.error(
      "Database close error:",
      error
    );
  }

  process.exit(0);
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `ALL WORLD BRANDS running on port ${PORT}`
    );

    console.log(
      `World directory entries: ${countryCodes.size}`
    );

    console.log(
      `OCTO shop ID: ${OCTO_SHOP_ID}`
    );

    console.log(
      `OCTO configured: ${
        OCTO_SECRET
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `Site URL: ${SITE_URL}`
    );
  }
);
