const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;
const DB_FILE =
  process.env.DB_FILE || path.join(__dirname, "allworldbrands.db");

const SITE_URL = "https://allworldbrands.net";

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");

/* =========================
   DATABASE
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  website TEXT,
  verification TEXT DEFAULT 'Unverified',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(country_id) REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS factories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  address TEXT,
  source TEXT,
  FOREIGN KEY(brand_id) REFERENCES brands(id)
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_name TEXT NOT NULL,
  country TEXT NOT NULL,
  owner_name TEXT,
  owner_email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  description TEXT,
  package TEXT DEFAULT 'Basic',
  price TEXT DEFAULT '$1.00',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* =========================
   MIGRATIONS
========================= */

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("brands", "category", "TEXT");
addColumnIfMissing("brands", "description", "TEXT");
addColumnIfMissing("brands", "website", "TEXT");
addColumnIfMissing("brands", "verification", "TEXT DEFAULT 'Unverified'");
addColumnIfMissing("applications", "owner_name", "TEXT");
addColumnIfMissing("applications", "phone", "TEXT");
addColumnIfMissing("applications", "description", "TEXT");
addColumnIfMissing("applications", "price", "TEXT DEFAULT '$1.00'");

/* =========================
   COUNTRIES
========================= */

const countries = [
  ["Afghanistan","AF"],
  ["Albania","AL"],
  ["Algeria","DZ"],
  ["Andorra","AD"],
  ["Angola","AO"],
  ["Antigua and Barbuda","AG"],
  ["Argentina","AR"],
  ["Armenia","AM"],
  ["Australia","AU"],
  ["Austria","AT"],
  ["Azerbaijan","AZ"],
  ["Bahamas","BS"],
  ["Bahrain","BH"],
  ["Bangladesh","BD"],
  ["Barbados","BB"],
  ["Belarus","BY"],
  ["Belgium","BE"],
  ["Belize","BZ"],
  ["Benin","BJ"],
  ["Bhutan","BT"],
  ["Bolivia","BO"],
  ["Bosnia and Herzegovina","BA"],
  ["Botswana","BW"],
  ["Brazil","BR"],
  ["Brunei","BN"],
  ["Bulgaria","BG"],
  ["Burkina Faso","BF"],
  ["Burundi","BI"],
  ["Cambodia","KH"],
  ["Cameroon","CM"],
  ["Canada","CA"],
  ["Cape Verde","CV"],
  ["Central African Republic","CF"],
  ["Chad","TD"],
  ["Chile","CL"],
  ["China","CN"],
  ["Colombia","CO"],
  ["Comoros","KM"],
  ["Congo","CG"],
  ["Costa Rica","CR"],
  ["Croatia","HR"],
  ["Cuba","CU"],
  ["Cyprus","CY"],
  ["Czech Republic","CZ"],
  ["Denmark","DK"],
  ["Djibouti","DJ"],
  ["Dominica","DM"],
  ["Dominican Republic","DO"],
  ["Ecuador","EC"],
  ["Egypt","EG"],
  ["El Salvador","SV"],
  ["Equatorial Guinea","GQ"],
  ["Eritrea","ER"],
  ["Estonia","EE"],
  ["Eswatini","SZ"],
  ["Ethiopia","ET"],
  ["Fiji","FJ"],
  ["Finland","FI"],
  ["France","FR"],
  ["Gabon","GA"],
  ["Gambia","GM"],
  ["Georgia","GE"],
  ["Germany","DE"],
  ["Ghana","GH"],
  ["Greece","GR"],
  ["Grenada","GD"],
  ["Guatemala","GT"],
  ["Guinea","GN"],
  ["Guinea-Bissau","GW"],
  ["Guyana","GY"],
  ["Haiti","HT"],
  ["Honduras","HN"],
  ["Hong Kong","HK"],
  ["Hungary","HU"],
  ["Iceland","IS"],
  ["India","IN"],
  ["Indonesia","ID"],
  ["Iran","IR"],
  ["Iraq","IQ"],
  ["Ireland","IE"],
  ["Israel","IL"],
  ["Italy","IT"],
  ["Jamaica","JM"],
  ["Japan","JP"],
  ["Jordan","JO"],
  ["Kazakhstan","KZ"],
  ["Kenya","KE"],
  ["Kiribati","KI"],
  ["Kuwait","KW"],
  ["Kyrgyzstan","KG"],
  ["Laos","LA"],
  ["Latvia","LV"],
  ["Lebanon","LB"],
  ["Lesotho","LS"],
  ["Liberia","LR"],
  ["Libya","LY"],
  ["Liechtenstein","LI"],
  ["Lithuania","LT"],
  ["Luxembourg","LU"],
  ["Madagascar","MG"],
  ["Malawi","MW"],
  ["Malaysia","MY"],
  ["Maldives","MV"],
  ["Mali","ML"],
  ["Malta","MT"],
  ["Marshall Islands","MH"],
  ["Mauritania","MR"],
  ["Mauritius","MU"],
  ["Mexico","MX"],
  ["Micronesia","FM"],
  ["Moldova","MD"],
  ["Monaco","MC"],
  ["Mongolia","MN"],
  ["Montenegro","ME"],
  ["Morocco","MA"],
  ["Mozambique","MZ"],
  ["Myanmar","MM"],
  ["Namibia","NA"],
  ["Nauru","NR"],
  ["Nepal","NP"],
  ["Netherlands","NL"],
  ["New Zealand","NZ"],
  ["Nicaragua","NI"],
  ["Niger","NE"],
  ["Nigeria","NG"],
  ["North Korea","KP"],
  ["North Macedonia","MK"],
  ["Norway","NO"],
  ["Oman","OM"],
  ["Pakistan","PK"],
  ["Palau","PW"],
  ["Panama","PA"],
  ["Papua New Guinea","PG"],
  ["Paraguay","PY"],
  ["Peru","PE"],
  ["Philippines","PH"],
  ["Poland","PL"],
  ["Portugal","PT"],
  ["Qatar","QA"],
  ["Romania","RO"],
  ["Russia","RU"],
  ["Rwanda","RW"],
  ["Saint Kitts and Nevis","KN"],
  ["Saint Lucia","LC"],
  ["Saint Vincent and the Grenadines","VC"],
  ["Samoa","WS"],
  ["San Marino","SM"],
  ["Saudi Arabia","SA"],
  ["Senegal","SN"],
  ["Serbia","RS"],
  ["Seychelles","SC"],
  ["Sierra Leone","SL"],
  ["Singapore","SG"],
  ["Slovakia","SK"],
  ["Slovenia","SI"],
  ["Solomon Islands","SB"],
  ["Somalia","SO"],
  ["South Africa","ZA"],
  ["South Korea","KR"],
  ["South Sudan","SS"],
  ["Spain","ES"],
  ["Sri Lanka","LK"],
  ["Sudan","SD"],
  ["Suriname","SR"],
  ["Sweden","SE"],
  ["Switzerland","CH"],
  ["Syria","SY"],
  ["Taiwan","TW"],
  ["Tajikistan","TJ"],
  ["Tanzania","TZ"],
  ["Thailand","TH"],
  ["Timor-Leste","TL"],
  ["Togo","TG"],
  ["Tonga","TO"],
  ["Trinidad and Tobago","TT"],
  ["Tunisia","TN"],
  ["Türkiye","TR"],
  ["Turkmenistan","TM"],
  ["Tuvalu","TV"],
  ["Uganda","UG"],
  ["Ukraine","UA"],
  ["United Arab Emirates","AE"],
  ["United Kingdom","GB"],
  ["United States","US"],
  ["Uruguay","UY"],
  ["Uzbekistan","UZ"],
  ["Vanuatu","VU"],
  ["Vatican City","VA"],
  ["Venezuela","VE"],
  ["Vietnam","VN"],
  ["Yemen","YE"],
  ["Zambia","ZM"],
  ["Zimbabwe","ZW"],

  ["Aruba","AW"],
  ["Bermuda","BM"],
  ["Bonaire, Sint Eustatius and Saba","BQ"],
  ["British Virgin Islands","VG"],
  ["Cayman Islands","KY"],
  ["Christmas Island","CX"],
  ["Cocos (Keeling) Islands","CC"],
  ["Cook Islands","CK"],
  ["Curaçao","CW"],
  ["Falkland Islands","FK"],
  ["Faroe Islands","FO"],
  ["French Guiana","GF"],
  ["French Polynesia","PF"],
  ["Gibraltar","GI"],
  ["Greenland","GL"],
  ["Guadeloupe","GP"],
  ["Guam","GU"],
  ["Guernsey","GG"],
  ["Isle of Man","IM"],
  ["Jersey","JE"],
  ["Macau","MO"],
  ["Martinique","MQ"],
  ["Mayotte","YT"],
  ["Montserrat","MS"],
  ["New Caledonia","NC"],
  ["Niue","NU"],
  ["Norfolk Island","NF"],
  ["Northern Mariana Islands","MP"],
  ["Pitcairn Islands","PN"],
  ["Puerto Rico","PR"],
  ["Réunion","RE"],
  ["Saint Barthélemy","BL"],
  ["Saint Helena","SH"],
  ["Saint Martin","MF"],
  ["Saint Pierre and Miquelon","PM"],
  ["Sint Maarten","SX"],
  ["South Georgia and the South Sandwich Islands","GS"],
  ["Tokelau","TK"],
  ["Turks and Caicos Islands","TC"],
  ["U.S. Virgin Islands","VI"],
  ["Wallis and Futuna","WF"],
  ["Western Sahara","EH"]
];

const insertCountry = db.prepare(
  "INSERT OR IGNORE INTO countries (name, code) VALUES (?, ?)"
);

const insertCountries = db.transaction((items) => {
  for (const item of items) {
    insertCountry.run(item[0], item[1]);
  }
});

insertCountries(countries);

/* =========================
   STARTER BRANDS
========================= */

const seedBrands = [
  ["US","Apple","Electronics","Technology brand profile.","https://www.apple.com"],
  ["US","Nike","Sports","Sportswear and footwear brand profile.","https://www.nike.com"],
  ["GB","Burberry","Luxury","British luxury fashion brand profile.","https://www.burberry.com"],
  ["DE","BMW","Automotive","German automotive brand profile.","https://www.bmw.com"],
  ["FR","L'Oréal","Cosmetics","Beauty brand profile.","https://www.loreal.com"],
  ["IT","Ferrari","Automotive","Italian automotive brand profile.","https://www.ferrari.com"],
  ["TR","Arçelik","Home","Home appliances brand profile.","https://www.arcelik.com.tr"],
  ["UZ","Artel","Electronics","Uzbek consumer electronics brand profile.","https://artelelectronics.com"],
  ["JP","Toyota","Automotive","Japanese automotive brand profile.","https://global.toyota"],
  ["KR","Samsung","Electronics","Technology brand profile.","https://www.samsung.com"],
  ["CN","Huawei","Electronics","Technology brand profile.","https://www.huawei.com"],
  ["IN","Tata","Industrial","Business group profile.","https://www.tata.com"]
];

const insertBrand = db.prepare(`
  INSERT INTO brands
  (country_id, name, category, description, website, verification)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const brandCount = db
  .prepare("SELECT COUNT(*) AS count FROM brands")
  .get().count;

if (brandCount === 0) {
  const getCountry = db.prepare(
    "SELECT id FROM countries WHERE code = ?"
  );

  const seed = db.transaction(() => {
    for (const b of seedBrands) {
      const country = getCountry.get(b[0]);

      if (country) {
        insertBrand.run(
          country.id,
          b[1],
          b[2],
          b[3],
          b[4],
          "Official source"
        );
      }
    }
  });

  seed();
}

/* =========================
   SECURITY / MIDDLEWARE
========================= */

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(morgan("tiny"));

app.use(express.json({
  limit: "1mb"
}));

app.use(express.urlencoded({
  extended: true
}));

/* =========================
   MAIN DOMAIN REDIRECT
========================= */

app.use((req, res, next) => {
  const host = String(req.headers.host || "")
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

/* =========================
   ROBOTS.TXT
========================= */

app.get("/robots.txt", (req, res) => {
  res.type("text/plain");

  res.send(
`User-agent: *
Allow: /

Disallow: /admin
Disallow: /api

Sitemap: ${SITE_URL}/sitemap.xml
`
  );
});

/* =========================
   SEO HELPER
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seoPage({
  title,
  description,
  url,
  body,
  type = "website"
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(url);

  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    "name": title,
    "description": description,
    "url": url
  };

  return `<!doctype html>
<html lang="en">
<head>

<meta charset="utf-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

<title>${safeTitle}</title>

<meta name="description"
content="${safeDescription}">

<meta name="robots"
content="index, follow, max-image-preview:large">

<link rel="canonical"
href="${safeUrl}">

<meta property="og:type"
content="${type === "Product" ? "website" : "website"}">

<meta property="og:title"
content="${safeTitle}">

<meta property="og:description"
content="${safeDescription}">

<meta property="og:url"
content="${safeUrl}">

<meta property="og:site_name"
content="ALL WORLD BRANDS">

<meta name="twitter:card"
content="summary_large_image">

<meta name="twitter:title"
content="${safeTitle}">

<meta name="twitter:description"
content="${safeDescription}">

<script type="application/ld+json">
${JSON.stringify(schema)}
</script>

</head>

<body>

${body}

</body>
</html>`;
}

/* =========================
   SITEMAP
========================= */

app.get("/sitemap.xml", (req, res) => {
  const countryRows = db
    .prepare("SELECT id FROM countries ORDER BY id")
    .all();

  const brandRows = db
    .prepare("SELECT id FROM brands ORDER BY id")
    .all();

  let urls = `
<url>
  <loc>${SITE_URL}/</loc>
  <changefreq>daily</changefreq>
  <priority>1.0</priority>
</url>
`;

  for (const c of countryRows) {
    urls += `
<url>
  <loc>${SITE_URL}/country/${c.id}</loc>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
`;
  }

  for (const b of brandRows) {
    urls += `
<url>
  <loc>${SITE_URL}/brand/${b.id}</loc>
  <changefreq>weekly</changefreq>
  <priority>0.7</priority>
</url>
`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.type("application/xml");
  res.send(xml);
});

/* =========================
   API HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ALL WORLD BRANDS API"
  });
});

/* =========================
   COUNTRIES API
========================= */

app.get("/api/countries", (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM countries ORDER BY name COLLATE NOCASE"
    )
    .all();

  res.json(rows);
});

/* =========================
   COUNTRY BRANDS API
========================= */

app.get("/api/countries/:id/brands", (req, res) => {
  const rows = db.prepare(`
    SELECT *
    FROM brands
    WHERE country_id = ?
    ORDER BY name COLLATE NOCASE
  `).all(req.params.id);

  res.json(rows);
});

/* =========================
   BRAND API
========================= */

app.get("/api/brands/:id", (req, res) => {
  const brand = db.prepare(`
    SELECT
      b.*,
      c.name AS country_name,
      c.code AS country_code
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

  brand.factories = db.prepare(`
    SELECT *
    FROM factories
    WHERE brand_id = ?
    ORDER BY name
  `).all(req.params.id);

  res.json(brand);
});

/* =========================
   SEARCH API
========================= */

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.json([]);
  }

  const s = `%${q}%`;

  const rows = db.prepare(`
    SELECT
      b.id,
      b.name,
      b.category,
      b.description,
      b.website,
      b.verification,
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
    ORDER BY b.name COLLATE NOCASE
    LIMIT 50
  `).all(s, s, s, s);

  res.json(rows);
});

/* =========================
   BRAND APPLICATION
========================= */

app.post("/api/applications", (req, res) => {
  const x = req.body || {};

  /*
    Frontend yuborishi mumkin:
    name
    email
    phone
    message

    Yoki:
    brand_name
    country
    owner_email
    website
  */

  const brandName = String(
    x.brand_name ||
    x.name ||
    ""
  ).trim();

  const email = String(
    x.owner_email ||
    x.email ||
    ""
  ).trim();

  const phone = String(
    x.phone ||
    ""
  ).trim();

  const website = String(
    x.website ||
    ""
  ).trim();

  const message = String(
    x.description ||
    x.message ||
    ""
  ).trim();

  let country = String(
    x.country ||
    ""
  ).trim();

  /*
    Eski frontend country ni message ichida yuboradi.
  */

  if (!country && message) {
    const match = message.match(
      /Country:\s*(.+?)(?:\n|$)/i
    );

    if (match) {
      country = match[1].trim();
    }
  }

  if (!brandName || !email || !country) {
    return res.status(400).json({
      error:
        "Brand name, country and email are required"
    });
  }

  const packageName = String(
    x.package ||
    "Basic"
  ).trim();

  const result = db.prepare(`
    INSERT INTO applications
    (
      brand_name,
      country,
      owner_name,
      owner_email,
      phone,
      website,
      description,
      package,
      price
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    brandName,
    country,
    String(x.owner_name || x.name || "").trim(),
    email,
    phone,
    website,
    message,
    packageName,
    "$1.00"
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    status: "pending",
    message: "Application received",
    price: "$1.00"
  });
});

/* =========================
   ADMIN AUTH
========================= */

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Basic ")) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );

    return res.status(401).send(
      "Authentication required"
    );
  }

  const encoded = auth.split(" ")[1];

  let decoded = "";

  try {
    decoded = Buffer
      .from(encoded, "base64")
      .toString("utf8");
  } catch {
    return res.status(401).send(
      "Invalid authentication"
    );
  }

  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return res.status(401).send(
      "Invalid authentication"
    );
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const adminUser =
    process.env.ADMIN_USER || "admin";

  const adminPassword =
    process.env.ADMIN_PASSWORD;

  if (
    !adminPassword ||
    username !== adminUser ||
    password !== adminPassword
  ) {
    return res.status(401).send(
      "Invalid username or password"
    );
  }

  next();
}

/* =========================
   ADMIN PAGE
========================= */

app.get("/admin", adminAuth, (req, res) => {
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
});

/* =========================
   ADMIN APPLICATIONS
========================= */

app.get(
  "/api/admin/applications",
  adminAuth,
  (req, res) => {
    const rows = db.prepare(`
      SELECT *
      FROM applications
      ORDER BY created_at DESC
    `).all();

    res.json(rows);
  }
);

/* =========================
   ADMIN BRANDS
========================= */

app.get(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {
    const rows = db.prepare(`
      SELECT
        b.*,
        c.name AS country_name,
        c.code AS country_code
      FROM brands b
      JOIN countries c
        ON c.id = b.country_id
      ORDER BY b.created_at DESC
    `).all();

    res.json(rows);
  }
);

/* =========================
   ADMIN ADD BRAND
========================= */

app.post(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {
    const x = req.body || {};

    if (!x.name || !x.country_id) {
      return res.status(400).json({
        error: "name and country_id are required"
      });
    }

    const result = db.prepare(`
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
    `).run(
      Number(x.country_id),
      String(x.name).trim(),
      String(x.category || "").trim(),
      String(x.description || "").trim(),
      String(x.website || "").trim(),
      String(x.verification || "Unverified").trim()
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: "Brand created"
    });
  }
);

/* =========================
   ADMIN UPDATE BRAND
========================= */

app.put(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {
    const x = req.body || {};

    const result = db.prepare(`
      UPDATE brands
      SET
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        website = COALESCE(?, website),
        verification = COALESCE(?, verification)
      WHERE id = ?
    `).run(
      x.name ?? null,
      x.category ?? null,
      x.description ?? null,
      x.website ?? null,
      x.verification ?? null,
      req.params.id
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Brand not found"
      });
    }

    res.json({
      ok: true,
      message: "Brand updated"
    });
  }
);

/* =========================
   ADMIN DELETE BRAND
========================= */

app.delete(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {
    const result = db.prepare(
      "DELETE FROM brands WHERE id = ?"
    ).run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Brand not found"
      });
    }

    res.json({
      ok: true,
      message: "Brand deleted"
    });
  }
);

/* =========================
   ADMIN APPLICATION STATUS
========================= */

app.put(
  "/api/admin/applications/:id/status",
  adminAuth,
  (req, res) => {
    const status = String(
      req.body.status || ""
    ).trim();

    const allowed = [
      "pending",
      "approved",
      "rejected"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "Invalid status"
      });
    }

    const result = db.prepare(`
      UPDATE applications
      SET status = ?
      WHERE id = ?
    `).run(
      status,
      req.params.id
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Application not found"
      });
    }

    res.json({
      ok: true,
      status
    });
  }
);

/* =========================
   SEO COUNTRY PAGE
========================= */

app.get("/country/:id", (req, res) => {
  const country = db.prepare(`
    SELECT *
    FROM countries
    WHERE id = ?
  `).get(req.params.id);

  if (!country) {
    return res.status(404).send(
      "Country not found"
    );
  }

  const brands = db.prepare(`
    SELECT id, name, category
    FROM brands
    WHERE country_id = ?
    ORDER BY name COLLATE NOCASE
  `).all(req.params.id);

  const links = brands.map((b) => `
    <li>
      <a href="/brand/${b.id}">
        ${escapeHtml(b.name)}
      </a>
      ${b.category
        ? ` — ${escapeHtml(b.category)}`
        : ""}
    </li>
  `).join("");

  const body = `
    <main>
      <h1>${escapeHtml(country.name)}</h1>

      <p>
        Brands, companies and businesses
        from ${escapeHtml(country.name)}.
      </p>

      ${
        brands.length
          ? `<h2>Brands</h2><ul>${links}</ul>`
          : `<p>No brands listed yet.</p>`
      }

      <p>
        <a href="/">← ALL WORLD BRANDS</a>
      </p>
    </main>
  `;

  res.send(
    seoPage({
      title:
        `${country.name} Brands | ALL WORLD BRANDS`,
      description:
        `Discover brands, companies and businesses from ${country.name}.`,
      url:
        `${SITE_URL}/country/${country.id}`,
      body
    })
  );
});

/* =========================
   SEO BRAND PAGE
========================= */

app.get("/brand/:id", (req, res) => {
  const brand = db.prepare(`
    SELECT
      b.*,
      c.name AS country_name,
      c.id AS country_id
    FROM brands b
    JOIN countries c
      ON c.id = b.country_id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!brand) {
    return res.status(404).send(
      "Brand not found"
    );
  }

  const body = `
    <main>

      <h1>${escapeHtml(brand.name)}</h1>

      <p>
        <strong>Country:</strong>
        <a href="/country/${brand.country_id}">
          ${escapeHtml(brand.country_name)}
        </a>
      </p>

      ${
        brand.category
          ? `<p><strong>Category:</strong>
             ${escapeHtml(brand.category)}</p>`
          : ""
      }

      <p>
        ${escapeHtml(
          brand.description ||
          "Brand profile on ALL WORLD BRANDS."
        )}
      </p>

      ${
        brand.website
          ? `<p>
              <a href="${escapeHtml(brand.website)}"
                 target="_blank"
                 rel="noopener noreferrer">
                Official website
              </a>
             </p>`
          : ""
      }

      <p>
        <a href="/">← ALL WORLD BRANDS</a>
      </p>

    </main>
  `;

  res.send(
    seoPage({
      title:
        `${brand.name} | ALL WORLD BRANDS`,
      description:
        `${brand.name} brand profile from ${brand.country_name}.`,
      url:
        `${SITE_URL}/brand/${brand.id}`,
      body,
      type: "Product"
    })
  );
});

/* =========================
   STATIC FILES
========================= */

app.use(
  "/admin",
  adminAuth,
  express.static(
    path.join(__dirname, "public", "admin")
  )
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================
   FRONTEND FALLBACK
========================= */

app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(
    `ALL WORLD BRANDS running on port ${PORT}`
  );
});
