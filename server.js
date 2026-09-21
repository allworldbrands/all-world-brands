const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://allworldbrands.net";

app.disable("x-powered-by");

/* DATABASE */
const DB_FILE =
  process.env.DB_FILE ||
  path.join(__dirname, "allworldbrands.db");

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

/* TABLES */
db.exec(`
  CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country_id INTEGER,
    description TEXT,
    website TEXT,
    logo TEXT,
    FOREIGN KEY(country_id) REFERENCES countries(id)
  );

  CREATE TABLE IF NOT EXISTS factories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand_id INTEGER,
    country_id INTEGER,
    description TEXT,
    address TEXT,
    FOREIGN KEY(brand_id) REFERENCES brands(id),
    FOREIGN KEY(country_id) REFERENCES countries(id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new'
  );
`);
/* PAYMENT FIELDS */
const paymentColumns = [
  ["payment_status", "TEXT DEFAULT 'unpaid'"],
  ["amount", "REAL DEFAULT 1"],
  ["currency", "TEXT DEFAULT 'USD'"],
  ["octo_transaction_id", "TEXT"],
  ["octo_payment_uuid", "TEXT"],
  ["paid_at", "DATETIME"]
];

for (const [column, definition] of paymentColumns) {
  const exists = db.prepare(
    "SELECT 1 FROM pragma_table_info('applications') WHERE name = ?"
  ).get(column);

  if (!exists) {
    db.exec(`ALTER TABLE applications ADD COLUMN ${column} ${definition}`);
  }
}



/* 249 ISO 3166-1 entries + Kosovo */
const countryData = [
  "Afghanistan", "AF",
  "Albania", "AL",
  "Algeria", "DZ",
  "American Samoa", "AS",
  "Andorra", "AD",
  "Angola", "AO",
  "Anguilla", "AI",
  "Antarctica", "AQ",
  "Antigua and Barbuda", "AG",
  "Argentina", "AR",
  "Armenia", "AM",
  "Aruba", "AW",
  "Australia", "AU",
  "Austria", "AT",
  "Azerbaijan", "AZ",
  "Bahamas", "BS",
  "Bahrain", "BH",
  "Bangladesh", "BD",
  "Barbados", "BB",
  "Belarus", "BY",
  "Belgium", "BE",
  "Belize", "BZ",
  "Benin", "BJ",
  "Bermuda", "BM",
  "Bhutan", "BT",
  "Bolivia", "BO",
  "Bonaire, Sint Eustatius and Saba", "BQ",
  "Bosnia and Herzegovina", "BA",
  "Botswana", "BW",
  "Bouvet Island", "BV",
  "Brazil", "BR",
  "British Indian Ocean Territory", "IO",
  "British Virgin Islands", "VG",
  "Brunei", "BN",
  "Bulgaria", "BG",
  "Burkina Faso", "BF",
  "Burundi", "BI",
  "Cambodia", "KH",
  "Cameroon", "CM",
  "Canada", "CA",
  "Cape Verde", "CV",
  "Cayman Islands", "KY",
  "Central African Republic", "CF",
  "Chad", "TD",
  "Chile", "CL",
  "China", "CN",
  "Christmas Island", "CX",
  "Cocos (Keeling) Islands", "CC",
  "Colombia", "CO",
  "Comoros", "KM",
  "Congo", "CG",
  "Congo, Democratic Republic of the", "CD",
  "Cook Islands", "CK",
  "Costa Rica", "CR",
  "Croatia", "HR",
  "Cuba", "CU",
  "Curaçao", "CW",
  "Cyprus", "CY",
  "Czech Republic", "CZ",
  "Côte d’Ivoire", "CI",
  "Denmark", "DK",
  "Djibouti", "DJ",
  "Dominica", "DM",
  "Dominican Republic", "DO",
  "Ecuador", "EC",
  "Egypt", "EG",
  "El Salvador", "SV",
  "Equatorial Guinea", "GQ",
  "Eritrea", "ER",
  "Estonia", "EE",
  "Eswatini", "SZ",
  "Ethiopia", "ET",
  "Falkland Islands", "FK",
  "Faroe Islands", "FO",
  "Fiji", "FJ",
  "Finland", "FI",
  "France", "FR",
  "French Guiana", "GF",
  "French Polynesia", "PF",
  "French Southern Territories", "TF",
  "Gabon", "GA",
  "Gambia", "GM",
  "Georgia", "GE",
  "Germany", "DE",
  "Ghana", "GH",
  "Gibraltar", "GI",
  "Greece", "GR",
  "Greenland", "GL",
  "Grenada", "GD",
  "Guadeloupe", "GP",
  "Guam", "GU",
  "Guatemala", "GT",
  "Guernsey", "GG",
  "Guinea", "GN",
  "Guinea-Bissau", "GW",
  "Guyana", "GY",
  "Haiti", "HT",
  "Heard Island and McDonald Islands", "HM",
  "Honduras", "HN",
  "Hong Kong", "HK",
  "Hungary", "HU",
  "Iceland", "IS",
  "India", "IN",
  "Indonesia", "ID",
  "Iran", "IR",
  "Iraq", "IQ",
  "Ireland", "IE",
  "Isle of Man", "IM",
  "Israel", "IL",
  "Italy", "IT",
  "Jamaica", "JM",
  "Japan", "JP",
  "Jersey", "JE",
  "Jordan", "JO",
  "Kazakhstan", "KZ",
  "Kenya", "KE",
  "Kiribati", "KI",
  "Kosovo", "XK",
  "Kuwait", "KW",
  "Kyrgyzstan", "KG",
  "Laos", "LA",
  "Latvia", "LV",
  "Lebanon", "LB",
  "Lesotho", "LS",
  "Liberia", "LR",
  "Libya", "LY",
  "Liechtenstein", "LI",
  "Lithuania", "LT",
  "Luxembourg", "LU",
  "Macau", "MO",
  "Madagascar", "MG",
  "Malawi", "MW",
  "Malaysia", "MY",
  "Maldives", "MV",
  "Mali", "ML",
  "Malta", "MT",
  "Marshall Islands", "MH",
  "Martinique", "MQ",
  "Mauritania", "MR",
  "Mauritius", "MU",
  "Mayotte", "YT",
  "Mexico", "MX",
  "Micronesia", "FM",
  "Moldova", "MD",
  "Monaco", "MC",
  "Mongolia", "MN",
  "Montenegro", "ME",
  "Montserrat", "MS",
  "Morocco", "MA",
  "Mozambique", "MZ",
  "Myanmar", "MM",
  "Namibia", "NA",
  "Nauru", "NR",
  "Nepal", "NP",
  "Netherlands", "NL",
  "New Caledonia", "NC",
  "New Zealand", "NZ",
  "Nicaragua", "NI",
  "Niger", "NE",
  "Nigeria", "NG",
  "Niue", "NU",
  "Norfolk Island", "NF",
  "North Korea", "KP",
  "North Macedonia", "MK",
  "Northern Mariana Islands", "MP",
  "Norway", "NO",
  "Oman", "OM",
  "Pakistan", "PK",
  "Palau", "PW",
  "Palestine", "PS",
  "Panama", "PA",
  "Papua New Guinea", "PG",
  "Paraguay", "PY",
  "Peru", "PE",
  "Philippines", "PH",
  "Pitcairn Islands", "PN",
  "Poland", "PL",
  "Portugal", "PT",
  "Puerto Rico", "PR",
  "Qatar", "QA",
  "Romania", "RO",
  "Russia", "RU",
  "Rwanda", "RW",
  "Réunion", "RE",
  "Saint Barthélemy", "BL",
  "Saint Helena, Ascension and Tristan da Cunha", "SH",
  "Saint Kitts and Nevis", "KN",
  "Saint Lucia", "LC",
  "Saint Martin", "MF",
  "Saint Pierre and Miquelon", "PM",
  "Saint Vincent and the Grenadines", "VC",
  "Samoa", "WS",
  "San Marino", "SM",
  "Sao Tome and Principe", "ST",
  "Saudi Arabia", "SA",
  "Senegal", "SN",
  "Serbia", "RS",
  "Seychelles", "SC",
  "Sierra Leone", "SL",
  "Singapore", "SG",
  "Sint Maarten (Dutch part)", "SX",
  "Slovakia", "SK",
  "Slovenia", "SI",
  "Solomon Islands", "SB",
  "Somalia", "SO",
  "South Africa", "ZA",
  "South Georgia and the South Sandwich Islands", "GS",
  "South Korea", "KR",
  "South Sudan", "SS",
  "Spain", "ES",
  "Sri Lanka", "LK",
  "Sudan", "SD",
  "Suriname", "SR",
  "Svalbard and Jan Mayen", "SJ",
  "Sweden", "SE",
  "Switzerland", "CH",
  "Syria", "SY",
  "Taiwan", "TW",
  "Tajikistan", "TJ",
  "Tanzania", "TZ",
  "Thailand", "TH",
  "Timor-Leste", "TL",
  "Togo", "TG",
  "Tokelau", "TK",
  "Tonga", "TO",
  "Trinidad and Tobago", "TT",
  "Tunisia", "TN",
  "Turkey", "TR",
  "Turkmenistan", "TM",
  "Turks and Caicos Islands", "TC",
  "Tuvalu", "TV",
  "U.S. Virgin Islands", "VI",
  "Uganda", "UG",
  "Ukraine", "UA",
  "United Arab Emirates", "AE",
  "United Kingdom", "GB",
  "United States", "US",
  "United States Minor Outlying Islands", "UM",
  "Uruguay", "UY",
  "Uzbekistan", "UZ",
  "Vanuatu", "VU",
  "Vatican City", "VA",
  "Venezuela", "VE",
  "Vietnam", "VN",
  "Wallis and Futuna", "WF",
  "Western Sahara", "EH",
  "Yemen", "YE",
  "Zambia", "ZM",
  "Zimbabwe", "ZW",
  "Åland Islands", "AX"
];

const countryCodes = new Map();
for (let i = 0; i < countryData.length; i += 2) {
  countryCodes.set(countryData[i], countryData[i + 1]);
}

const insertCountry = db.prepare(
  `INSERT OR IGNORE INTO countries (name) VALUES (?)`
);

const insertCountries = db.transaction(() => {
  for (let i = 0; i < countryData.length; i += 2) {
    insertCountry.run(countryData[i]);
  }
});

insertCountries();

/* STARTER BRANDS */
const starterBrands = [
  ["Apple","United States"],
  ["Nike","United States"],
  ["Burberry","United Kingdom"],
  ["BMW","Germany"],
  ["L'Oréal","France"],
  ["Ferrari","Italy"],
  ["Arçelik","Turkey"],
  ["Artel","Uzbekistan"],
  ["Toyota","Japan"],
  ["Samsung","South Korea"],
  ["Huawei","China"],
  ["Tata","India"]
];

const findCountry = db.prepare(
  `SELECT id FROM countries WHERE name = ?`
);

const insertBrand = db.prepare(
  `INSERT INTO brands (name, country_id) VALUES (?, ?)`
);

for (const [brandName, countryName] of starterBrands) {
  const country = findCountry.get(countryName);
  if (country) {
    const exists = db.prepare(
      `SELECT id FROM brands WHERE name = ?`
    ).get(brandName);

    if (!exists) insertBrand.run(brandName, country.id);
  }
}

/* MAIN DOMAIN: redirect old domain to canonical domain */
app.use((req, res, next) => {
  const host = String(req.headers.host || "").toLowerCase().split(":")[0];
  if (host === "dbrands.net" || host === "www.dbrands.net") {
    return res.redirect(301, SITE_URL + req.originalUrl);
  }
  next();
});

/* ROBOTS.TXT */
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Sitemap: ${SITE_URL}/sitemap.xml
`);
});

/* SITEMAP.XML */
app.get("/sitemap.xml", (req, res) => {
  const countries = db.prepare("SELECT id FROM countries ORDER BY id").all();
  const brands = db.prepare("SELECT id FROM brands ORDER BY id").all();
  let urls = `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  for (const c of countries) urls += `<url><loc>${SITE_URL}/country/${c.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  for (const b of brands) urls += `<url><loc>${SITE_URL}/brand/${b.id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","":"&quot;"}[m]));
}

/* SEO COUNTRY PAGE */
app.get("/country/:id", (req, res) => {
  const country = db.prepare("SELECT * FROM countries WHERE id = ?").get(req.params.id);
  if (!country) return res.status(404).send("Country not found.");
  const brands = db.prepare("SELECT id,name,description,website FROM brands WHERE country_id = ? ORDER BY name COLLATE NOCASE").all(req.params.id);
  const items = brands.map(b => `<li><a href="/brand/${b.id}">${htmlEscape(b.name)}</a></li>`).join("");
  const title = `${country.name} Brands | ALL WORLD BRANDS`;
  const description = `Discover brands and companies from ${country.name} on ALL WORLD BRANDS.`;
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${SITE_URL}/country/${country.id}"><meta property="og:title" content="${htmlEscape(title)}"><meta property="og:description" content="${htmlEscape(description)}"><meta property="og:url" content="${SITE_URL}/country/${country.id}"></head><body><main><h1>${htmlEscape(country.name)}</h1><p>${htmlEscape(description)}</p>${items ? `<h2>Brands</h2><ul>${items}</ul>` : `<p>No brands listed yet.</p>`}<p><a href="/">← ALL WORLD BRANDS</a></p></main></body></html>`);
});

/* SEO BRAND PAGE */
app.get("/brand/:id", (req, res) => {
  const brand = db.prepare(`SELECT brands.*, countries.name AS country_name, countries.id AS country_id FROM brands LEFT JOIN countries ON brands.country_id = countries.id WHERE brands.id = ?`).get(req.params.id);
  if (!brand) return res.status(404).send("Brand not found.");
  const title = `${brand.name} | ALL WORLD BRANDS`;
  const description = `${brand.name} brand profile from ${brand.country_name || "the world"}.`;
  const url = `${SITE_URL}/brand/${brand.id}`;
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${url}"><meta property="og:title" content="${htmlEscape(title)}"><meta property="og:description" content="${htmlEscape(description)}"><meta property="og:url" content="${url}"></head><body><main><h1>${htmlEscape(brand.name)}</h1><p><strong>Country:</strong> <a href="/country/${brand.country_id}">${htmlEscape(brand.country_name || "")}</a></p><p>${htmlEscape(brand.description || "Brand profile on ALL WORLD BRANDS.")}</p>${brand.website ? `<p><a href="${htmlEscape(brand.website)}" target="_blank" rel="noopener noreferrer">Official website</a></p>` : ""}<p><a href="/">← ALL WORLD BRANDS</a></p></main></body></html>`);
});

/* MIDDLEWARE */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));
app.use(express.json({ limit: "30kb" }));
app.use(express.urlencoded({ extended: true, limit: "30kb" }));

/* ADMIN AUTH */
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function adminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).send("Admin password is not configured.");
  }

  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Basic ")) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );
    return res.status(401).send("Admin login required.");
  }

  const encoded = auth.substring(6);
  let decoded;

  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch (error) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );
    return res.status(401).send("Invalid authentication.");
  }

  const separator = decoded.indexOf(":");

  if (separator === -1) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );
    return res.status(401).send("Invalid authentication.");
  }

  const username = decoded.substring(0, separator);
  const password = decoded.substring(separator + 1);

  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );
    return res.status(401).send("Wrong username or password.");
  }

  next();
}

/* PROTECTED ADMIN PAGE */
app.get("/admin", adminAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "admin", "admin.html"));
});

app.get("/admin/", adminAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "admin", "admin.html"));
});

app.get("/admin/admin.html", adminAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "admin", "admin.html"));
});

app.use(
  "/admin",
  adminAuth,
  express.static(path.join(__dirname, "public", "admin"), { index: false })
);

/* PUBLIC STATIC */
app.use(express.static(path.join(__dirname, "public")));

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ALL WORLD BRANDS",
    directoryEntries: countryCodes.size
  });
});

/* COUNTRIES + FLAG CODE */
app.get("/api/countries", (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM countries ORDER BY name ASC`
  ).all();

  res.json(
    rows.map(row => ({
      ...row,
      flag_code: countryCodes.get(row.name) || null
    }))
  );
});

/* BRANDS BY COUNTRY */
app.get("/api/countries/:id/brands", (req, res) => {
  const rows = db.prepare(`
    SELECT brands.*, countries.name AS country_name
    FROM brands
    LEFT JOIN countries ON brands.country_id = countries.id
    WHERE brands.country_id = ?
    ORDER BY brands.name ASC
  `).all(req.params.id);

  res.json(
    rows.map(row => ({
      ...row,
      country_code: countryCodes.get(row.country_name) || null
    }))
  );
});

/* BRAND DETAILS */
app.get("/api/brands/:id", (req, res) => {
  const brand = db.prepare(`
    SELECT brands.*, countries.name AS country_name
    FROM brands
    LEFT JOIN countries ON brands.country_id = countries.id
    WHERE brands.id = ?
  `).get(req.params.id);

  if (!brand) {
    return res.status(404).json({ error: "Brand not found" });
  }

  brand.country_code =
    countryCodes.get(brand.country_name) || null;

  res.json(brand);
});

/* SEARCH */
app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) return res.json([]);

  const search = `%${q}%`;

  const rows = db.prepare(`
    SELECT brands.id,
           brands.name,
           brands.description,
           brands.website,
           brands.logo,
           countries.name AS country_name
    FROM brands
    LEFT JOIN countries ON brands.country_id = countries.id
    WHERE brands.name LIKE ?
       OR countries.name LIKE ?
    ORDER BY brands.name ASC
    LIMIT 100
  `).all(search, search);

  res.json(
    rows.map(row => ({
      ...row,
      country_code: countryCodes.get(row.country_name) || null
    }))
  );
});

/* PUBLIC APPLICATION */
app.post("/api/applications", (req, res) => {
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

  if (!brand_name || !country || !owner_name || !email) {
    return res.status(400).json({
      ok: false,
      error: "Brand, country, name and email are required."
    });
  }

  const amount = Number(process.env.OCTO_AMOUNT || 1);
  const currency = String(process.env.OCTO_CURRENCY || "USD").toUpperCase();

  const result = db.prepare(`
    INSERT INTO applications
    (brand_name,country,owner_name,email,phone,website,logo,description,
     payment_status,amount,currency,status)
    VALUES (?,?,?,?,?,?,?,?, 'unpaid',?,?, 'new')
  `).run(
    String(brand_name).trim().slice(0, 200),
    String(country).trim().slice(0, 200),
    String(owner_name).trim().slice(0, 200),
    String(email).trim().slice(0, 320),
    String(phone || "").trim().slice(0, 80),
    String(website || "").trim().slice(0, 500),
    String(logo || "").trim().slice(0, 500),
    String(description || "").slice(0, 3000),
    amount,
    currency
  );

  res.json({
    ok: true,
    id: result.lastInsertRowid,
    payment_status: "unpaid"
  });
});

/* =====================================================
   OCTO PAYMENT
   Secret stays only in Render Environment Variables.
===================================================== */

const OCTO_SHOP_ID = Number(process.env.OCTO_SHOP_ID || 43051);
const OCTO_SECRET = process.env.OCTO_SECRET || "";
const OCTO_API_URL = "https://secure.octo.uz/prepare_payment";
const OCTO_AMOUNT = Number(process.env.OCTO_AMOUNT || 1);
const OCTO_CURRENCY =
  String(process.env.OCTO_CURRENCY || "USD").toUpperCase();
const OCTO_TEST =
  String(process.env.OCTO_TEST || "false").toLowerCase() === "true";

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return String(process.env.PUBLIC_BASE_URL).replace(/\/+$/, "");
  }

  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.secure ? "https" : "http");

  return `${proto}://${req.get("host")}`;
}

function octoInitTime() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");

  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

async function octoPrepare(payload) {
  const response = await fetch(OCTO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OCTO returned invalid JSON (${response.status})`);
  }

  if (!response.ok || Number(data.error || 0) !== 0) {
    throw new Error(
      data.errMessage ||
      data.errorMessage ||
      `OCTO error ${data.error || response.status}`
    );
  }

  return data;
}

/* CREATE PAYMENT */
app.post("/api/payments/octo/create", async (req, res) => {
  if (!OCTO_SECRET) {
    return res.status(503).json({
      ok: false,
      error: "OCTO_SECRET is not configured in Render."
    });
  }

  const {
    brand_name,
    country,
    owner_name,
    email,
    phone,
    website,
    description
  } = req.body;

  if (!brand_name || !country || !owner_name || !email) {
    return res.status(400).json({
      ok: false,
      error: "Brand, country, name and email are required."
    });
  }

  const application = db.prepare(`
    INSERT INTO applications
    (brand_name,country,owner_name,email,phone,website,description,
     payment_status,amount,currency,status)
    VALUES (?,?,?,?,?,?,?,'unpaid',?,?, 'new')
  `).run(
    String(brand_name).trim().slice(0, 200),
    String(country).trim().slice(0, 200),
    String(owner_name).trim().slice(0, 200),
    String(email).trim().slice(0, 320),
    String(phone || "").trim().slice(0, 80),
    String(website || "").trim().slice(0, 500),
    String(description || "").slice(0, 3000),
    OCTO_AMOUNT,
    OCTO_CURRENCY
  );

  const applicationId = Number(application.lastInsertRowid);

  const transactionId =
    `AWB-${applicationId}-${Date.now()}-${Math.random()
      .toString(36).slice(2, 8)}`;

  try {
    const baseUrl = getBaseUrl(req);

    const octo = await octoPrepare({
      octo_shop_id: OCTO_SHOP_ID,
      octo_secret: OCTO_SECRET,
      shop_transaction_id: transactionId,
      auto_capture: true,
      test: OCTO_TEST,
      init_time: octoInitTime(),

      user_data: {
        user_id: String(applicationId),
        phone: String(phone || ""),
        email: String(email).trim()
      },

      total_sum: OCTO_AMOUNT,
      currency: OCTO_CURRENCY,
      description:
        `ALL WORLD BRANDS - ${String(brand_name).trim()}`.slice(0, 200),

      basket: [
        {
          position_desc:
            `Brand listing - ${String(brand_name).trim()}`.slice(0, 200),
          count: 1,
          price: OCTO_AMOUNT
        }
      ],

      payment_methods: [
        { method: "bank_card" },
        { method: "uzcard" },
        { method: "humo" }
      ],

      return_url:
        `${baseUrl}/?payment=octo&application_id=${applicationId}`,

      notify_url:
        `${baseUrl}/api/octo/notify`,

      language: "uz",
      ttl: 15
    });

    const data = octo.data || octo;

    const paymentUuid =
      data.octo_payment_UUID ||
      data.octo_payment_uuid ||
      null;

    const payUrl =
      data.octo_pay_url ||
      data.payment_url ||
      null;

    if (!payUrl) {
      throw new Error("OCTO did not return octo_pay_url.");
    }

    db.prepare(`
      UPDATE applications
      SET octo_transaction_id = ?,
          octo_payment_uuid = ?
      WHERE id = ?
    `).run(transactionId, paymentUuid, applicationId);

    return res.json({
      ok: true,
      application_id: applicationId,
      payment_status: "unpaid",
      pay_url: payUrl
    });

  } catch (error) {
    console.error("OCTO create error:", error);

    return res.status(502).json({
      ok: false,
      error: "OCTO payment could not be created."
    });
  }
});

/* VERIFY REAL OCTO STATUS */
async function verifyOctoApplication(applicationId) {
  const application = db.prepare(`
    SELECT * FROM applications WHERE id = ?
  `).get(applicationId);

  if (!application) {
    throw new Error("Application not found.");
  }

  if (!application.octo_transaction_id) {
    throw new Error("OCTO transaction ID is missing.");
  }

  const octo = await octoPrepare({
    octo_shop_id: OCTO_SHOP_ID,
    octo_secret: OCTO_SECRET,
    shop_transaction_id: application.octo_transaction_id
  });

  const data = octo.data || octo;

  const status = String(data.status || "").toLowerCase();

  const total = Number(
    data.total_sum ??
    data.transfer_sum ??
    0
  );

  const successful =
    ["succeeded", "success", "paid", "captured"].includes(status);

  const expected = Number(application.amount || OCTO_AMOUNT);

  const amountMatches =
    Math.abs(total - expected) < 0.01;

  if (successful && amountMatches) {
    db.prepare(`
      UPDATE applications
      SET payment_status = 'paid',
          paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
      WHERE id = ?
    `).run(applicationId);
  }

  const fresh = db.prepare(`
    SELECT payment_status
    FROM applications
    WHERE id = ?
  `).get(applicationId);

  return {
    application_id: Number(applicationId),
    payment_status:
      fresh?.payment_status === "paid"
        ? "paid"
        : "unpaid",
    octo_status: status || "unknown",
    amount: total,
    expected_amount: expected,
    currency: application.currency || OCTO_CURRENCY
  };
}

/* STATUS CHECK */
app.get("/api/payments/octo/status/:applicationId", async (req, res) => {
  if (!OCTO_SECRET) {
    return res.status(503).json({
      ok: false,
      error: "OCTO_SECRET is not configured."
    });
  }

  try {
    const result =
      await verifyOctoApplication(req.params.applicationId);

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      ...result
    });

  } catch (error) {
    console.error("OCTO status error:", error);

    res.status(502).json({
      ok: false,
      error: "Could not verify OCTO payment."
    });
  }
});

/* OCTO CALLBACK */
app.post("/api/octo/notify", async (req, res) => {
  const uuid =
    req.body.octo_payment_UUID ||
    req.body.octo_payment_uuid ||
    "";

  if (!uuid) {
    return res.json({
      accept_status: "cancel"
    });
  }

  const application =
    db.prepare(`
      SELECT id
      FROM applications
      WHERE octo_payment_uuid = ?
    `).get(uuid);

  if (!application) {
    return res.json({
      accept_status: "cancel"
    });
  }

  try {
    const result =
      await verifyOctoApplication(application.id);

    return res.json({
      accept_status:
        result.payment_status === "paid"
          ? "capture"
          : "cancel",

      final_amount:
        Number(result.expected_amount)
    });

  } catch (error) {
    console.error("OCTO notify verification:", error);

    return res.json({
      accept_status: "cancel"
    });
  }
});

/* ADMIN BRANDS */
app.get("/api/admin/brands", adminAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT brands.*, countries.name AS country_name
    FROM brands
    LEFT JOIN countries ON brands.country_id = countries.id
    ORDER BY brands.id DESC
  `).all();

  res.json(rows);
});

/* ADD BRAND */
app.post("/api/admin/brands", adminAuth, (req, res) => {
  const { name, country_id, description, website, logo } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "Brand name is required."
    });
  }

  const result = db.prepare(`
    INSERT INTO brands
    (name,country_id,description,website,logo)
    VALUES (?,?,?,?,?)
  `).run(
    String(name).trim().slice(0, 200),
    country_id || null,
    String(description || "").slice(0, 3000),
    String(website || "").trim().slice(0, 500),
    String(logo || "").trim().slice(0, 500)
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

/* DELETE BRAND */
app.delete("/api/admin/brands/:id", adminAuth, (req, res) => {
  db.prepare(
    `DELETE FROM brands WHERE id = ?`
  ).run(req.params.id);

  res.json({ success: true });
});

/* ADMIN APPLICATIONS */
app.get("/api/admin/applications", adminAuth, (req, res) => {
  const rows = db.prepare(`
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
  `).all();

  res.setHeader("Cache-Control", "no-store");
  res.json(rows);
});

app.patch("/api/admin/applications/:id", adminAuth, (req, res) => {
  const allowed = ["new", "approved", "rejected"];
  const status = String(req.body.status || "");

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: "Invalid status"
    });
  }

  const result = db.prepare(`
    UPDATE applications
    SET status = ?
    WHERE id = ?
  `).run(status, req.params.id);

  res.json({
    success: true,
    changes: result.changes
  });
});

app.delete("/api/admin/applications/:id", adminAuth, (req, res) => {
  const result = db.prepare(`
    DELETE FROM applications
    WHERE id = ?
  `).run(req.params.id);

  res.json({
    success: true,
    changes: result.changes
  });
});

/* PUBLIC FALLBACK */
app.get(/.*/, (req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/admin")
  ) {
    return next();
  }

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

/* 404 */
app.use((req, res) => {
  res.status(404).send("Not found.");
});

/* ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

/* START */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ALL WORLD BRANDS running on port ${PORT}`);
  console.log(`World directory entries: ${countryCodes.size}`);
});
