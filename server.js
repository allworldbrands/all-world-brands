const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const PORT = process.env.PORT || 3000;

/*
=====================================================
PATHS
=====================================================
*/

const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(PUBLIC_DIR, "admin");

const DB_PATH =
  process.env.DB_PATH ||
  path.join(__dirname, "allworldbrands.db");

/*
=====================================================
BASIC SETUP
=====================================================
*/

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

/*
=====================================================
DIRECTORIES
=====================================================
*/

try {
  fs.mkdirSync(PUBLIC_DIR, {
    recursive: true
  });

  fs.mkdirSync(ADMIN_DIR, {
    recursive: true
  });
} catch (error) {
  console.error("Directory error:", error);
}

/*
=====================================================
18+ CONTENT PROTECTION
=====================================================
*/

const ADULT_CONTENT_WORDS = [
  "porn",
  "porno",
  "pornography",
  "pornographic",
  "xxx",
  "nsfw",
  "sex video",
  "sexvideo",
  "nude",
  "nudity",
  "naked",
  "adult video",
  "adultvideo",
  "explicit content",
  "explicit video",
  "onlyfans",
  "pornhub",
  "xvideos",
  "xnxx",
  "redtube",
  "brazzers",
  "hentai",
  "sexual content",
  "sex content"
];

function normalizeForModeration(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAdultContent(value) {
  const text = normalizeForModeration(value);

  if (!text) {
    return false;
  }

  return ADULT_CONTENT_WORDS.some((word) =>
    text.includes(normalizeForModeration(word))
  );
}

function isBlockedContent(value) {
  return containsAdultContent(value);
}

/*
=====================================================
URL SECURITY
=====================================================
*/

function isSafeUrl(value) {
  if (value === undefined || value === null) {
    return true;
  }

  const text = String(value).trim();

  if (!text) {
    return true;
  }

  if (text.length > 2048) {
    return false;
  }

  if (/[\u0000-\u001F\u007F]/.test(text)) {
    return false;
  }

  const lower = text.toLowerCase();

  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:") ||
    lower.startsWith("blob:")
  ) {
    return false;
  }

  /*
    Allow local files:

      /images/apple.png
      /uploads/logo.jpg
      ./images/logo.png

    But reject:

      //evil-site.com
  */

  if (text.startsWith("/")) {
    if (text.startsWith("//")) {
      return false;
    }

    return true;
  }

  if (text.startsWith("./")) {
    return true;
  }

  try {
    const url = new URL(text);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/*
=====================================================
VALIDATION HELPERS
=====================================================
*/

function cleanString(value, maxLength = 5000) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function validId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function validEmail(email) {
  const value = cleanString(email, 254);

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateUrls(values) {
  for (const value of values) {
    if (value && !isSafeUrl(value)) {
      return false;
    }
  }

  return true;
}

/*
=====================================================
DATABASE
=====================================================
*/

const db = new sqlite3.Database(
  DB_PATH,
  (error) => {
    if (error) {
      console.error("SQLite connection error:", error);
      process.exit(1);
    }

    console.log("SQLite connected:");
    console.log(DB_PATH);
  }
);

db.configure("busyTimeout", 5000);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

/*
=====================================================
COUNTRIES
=====================================================
*/

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
  ["Cocos Islands", "CC"],
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
  ["Holy See", "VA"],
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

/*
=====================================================
DATABASE INITIALIZATION
=====================================================
*/

async function addColumnIfMissing(
  table,
  column,
  definition
) {
  const columns = await dbAll(
    `PRAGMA table_info(${table})`
  );

  const exists = columns.some(
    (item) => item.name === column
  );

  if (!exists) {
    try {
      await dbRun(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
      );

      console.log(
        `Added column ${table}.${column}`
      );
    } catch (error) {
      console.error(
        `Migration error ${table}.${column}:`,
        error.message
      );
    }
  }
}

async function initializeDatabase() {
  /*
  ---------------------------------------------------
  PRAGMAS
  ---------------------------------------------------
  */

  try {
    await dbRun("PRAGMA foreign_keys = ON");
    await dbRun("PRAGMA journal_mode = WAL");
    await dbRun("PRAGMA synchronous = NORMAL");
  } catch (error) {
    console.error("PRAGMA error:", error.message);
  }

  /*
  ---------------------------------------------------
  TABLES
  ---------------------------------------------------
  */

  await dbRun(`
    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT
    )
  `);

  await dbRun(`
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

  await dbRun(`
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

  await dbRun(`
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

  /*
  ---------------------------------------------------
  SAFE MIGRATIONS
  ---------------------------------------------------
  */

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

  /*
    IMPORTANT:
    CURRENT_TIMESTAMP is not used directly in
    ALTER TABLE ADD COLUMN.
  */

  await addColumnIfMissing(
    "brands",
    "created_at",
    "DATETIME"
  );

  await dbRun(`
    UPDATE brands
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL
  `);

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
    "created_at",
    "DATETIME"
  );

  await dbRun(`
    UPDATE applications
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL
  `);

  /*
  ---------------------------------------------------
  INDEXES
  ---------------------------------------------------
  */

  await dbRun(`
    CREATE INDEX IF NOT EXISTS
    idx_brands_country_id
    ON brands(country_id)
  `);

  await dbRun(`
    CREATE INDEX IF NOT EXISTS
    idx_brands_name
    ON brands(name)
  `);

  await dbRun(`
    CREATE INDEX IF NOT EXISTS
    idx_applications_status
    ON applications(status)
  `);

  /*
  ---------------------------------------------------
  COUNTRIES
  ---------------------------------------------------
  */

  for (const [name, code] of countries) {
    await dbRun(
      `
      INSERT OR IGNORE INTO countries
      (name, code)
      VALUES (?, ?)
      `,
      [name, code]
    );
  }

  /*
  ---------------------------------------------------
  STARTER BRANDS
  ---------------------------------------------------
  */

  const starterBrands = [
    [
      "Apple",
      "United States",
      "Technology",
      "https://www.apple.com"
    ],
    [
      "Nike",
      "United States",
      "Sportswear",
      "https://www.nike.com"
    ],
    [
      "Burberry",
      "United Kingdom",
      "Fashion",
      "https://www.burberry.com"
    ],
    [
      "BMW",
      "Germany",
      "Automotive",
      "https://www.bmw.com"
    ],
    [
      "L'Oréal",
      "France",
      "Beauty",
      "https://www.loreal.com"
    ],
    [
      "Ferrari",
      "Italy",
      "Automotive",
      "https://www.ferrari.com"
    ],
    [
      "Arçelik",
      "Turkey",
      "Home Appliances",
      "https://www.arcelik.com"
    ],
    [
      "Artel",
      "Uzbekistan",
      "Electronics",
      "https://artelelectronics.com"
    ],
    [
      "Toyota",
      "Japan",
      "Automotive",
      "https://www.toyota.com"
    ],
    [
      "Samsung",
      "South Korea",
      "Electronics",
      "https://www.samsung.com"
    ],
    [
      "Huawei",
      "China",
      "Technology",
      "https://www.huawei.com"
    ],
    [
      "Tata",
      "India",
      "Conglomerate",
      "https://www.tata.com"
    ]
  ];

  for (const brand of starterBrands) {
    const [
      name,
      countryName,
      category,
      website
    ] = brand;

    const country = await dbGet(
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

    await dbRun(
      `
      INSERT INTO brands
      (
        country_id,
        name,
        category,
        website,
        verification
      )
      SELECT ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM brands
        WHERE name = ?
        AND country_id = ?
      )
      `,
      [
        country.id,
        name,
        category,
        website,
        "Official source",
        name,
        country.id
      ]
    );
  }

  console.log(
    `Database initialized. Countries: ${countries.length}`
  );
}

/*
=====================================================
MIDDLEWARE
=====================================================
*/

function rejectAdultContent(req, res, next) {
  const fields = [
    req.body?.brand_name,
    req.body?.name,
    req.body?.description,
    req.body?.category,
    req.body?.website,
    req.body?.logo,
    req.query?.q
  ];

  if (
    fields.some((field) =>
      isBlockedContent(field)
    )
  ) {
    return res.status(400).json({
      ok: false,
      error: "Adult content is not allowed."
    });
  }

  next();
}

/*
=====================================================
ADMIN AUTH
=====================================================
*/

function adminAuth(req, res, next) {
  const configuredUser =
    process.env.ADMIN_USER;

  const configuredPassword =
    process.env.ADMIN_PASSWORD;

  if (
    !configuredUser ||
    !configuredPassword
  ) {
    return res.status(503).json({
      ok: false,
      error:
        "Admin credentials are not configured."
    });
  }

  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Basic ")) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );

    return res.status(401).send(
      "Authentication required."
    );
  }

  let decoded;

  try {
    decoded = Buffer.from(
      header.slice(6),
      "base64"
    ).toString("utf8");
  } catch (error) {
    return res.status(401).send(
      "Invalid authentication."
    );
  }

  const separator =
    decoded.indexOf(":");

  if (separator === -1) {
    return res.status(401).send(
      "Invalid authentication."
    );
  }

  const username =
    decoded.slice(0, separator);

  const password =
    decoded.slice(separator + 1);

  if (
    username !== configuredUser ||
    password !== configuredPassword
  ) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="ALL WORLD BRANDS ADMIN"'
    );

    return res.status(401).send(
      "Invalid credentials."
    );
  }

  next();
}

/*
=====================================================
HEALTH
=====================================================
*/

app.get("/api/health", async (req, res) => {
  try {
    await dbGet("SELECT 1 AS ok");

    res.json({
      ok: true,
      service: "ALL WORLD BRANDS",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      database: "error"
    });
  }
});

/*
=====================================================
PUBLIC API
=====================================================
*/

/*
GET ALL COUNTRIES
*/

app.get("/api/countries", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT
        id,
        name,
        code
      FROM countries
      ORDER BY name COLLATE NOCASE ASC
    `);

    res.json({
      ok: true,
      countries: rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load countries."
    });
  }
});

/*
GET ONE COUNTRY
*/

app.get(
  "/api/countries/:id",
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid country ID."
      });
    }

    try {
      const country = await dbGet(
        `
        SELECT
          id,
          name,
          code
        FROM countries
        WHERE id = ?
        `,
        [id]
      );

      if (!country) {
        return res.status(404).json({
          ok: false,
          error: "Country not found."
        });
      }

      res.json({
        ok: true,
        country
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to load country."
      });
    }
  }
);

/*
GET BRANDS BY COUNTRY
*/

app.get(
  "/api/countries/:id/brands",
  async (req, res) => {
    const countryId =
      validId(req.params.id);

    if (!countryId) {
      return res.status(400).json({
        ok: false,
        error: "Invalid country ID."
      });
    }

    try {
      const country = await dbGet(
        `
        SELECT id, name, code
        FROM countries
        WHERE id = ?
        `,
        [countryId]
      );

      if (!country) {
        return res.status(404).json({
          ok: false,
          error: "Country not found."
        });
      }

      const brands = await dbAll(
        `
        SELECT
          id,
          country_id,
          name,
          logo,
          category,
          description,
          website,
          verification,
          created_at
        FROM brands
        WHERE country_id = ?
        ORDER BY name COLLATE NOCASE ASC
        `,
        [countryId]
      );

      res.json({
        ok: true,
        country,
        brands
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to load brands."
      });
    }
  }
);

/*
GET ONE BRAND
*/

app.get(
  "/api/brands/:id",
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid brand ID."
      });
    }

    try {
      const brand = await dbGet(
        `
        SELECT
          b.id,
          b.country_id,
          b.name,
          b.logo,
          b.category,
          b.description,
          b.website,
          b.verification,
          b.created_at,
          c.name AS country,
          c.code AS country_code
        FROM brands b
        JOIN countries c
          ON c.id = b.country_id
        WHERE b.id = ?
        `,
        [id]
      );

      if (!brand) {
        return res.status(404).json({
          ok: false,
          error: "Brand not found."
        });
      }

      res.json({
        ok: true,
        brand
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to load brand."
      });
    }
  }
);

/*
=====================================================
GLOBAL SEARCH
=====================================================
*/

app.get(
  "/api/search",
  rejectAdultContent,
  async (req, res) => {
    const q = cleanString(
      req.query.q,
      200
    );

    if (!q) {
      return res.json({
        ok: true,
        query: "",
        results: []
      });
    }

    if (isBlockedContent(q)) {
      return res.status(400).json({
        ok: false,
        error:
          "Adult content is not allowed."
      });
    }

    try {
      const search = `%${q}%`;

      const results = await dbAll(
        `
        SELECT
          b.id,
          b.country_id,
          b.name,
          b.logo,
          b.category,
          b.description,
          b.website,
          b.verification,
          b.created_at,
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
        ORDER BY
          CASE
            WHEN b.name LIKE ? THEN 0
            WHEN c.name LIKE ? THEN 1
            ELSE 2
          END,
          b.name COLLATE NOCASE ASC
        LIMIT 100
        `,
        [
          search,
          search,
          search,
          search,
          search,
          search
        ]
      );

      res.json({
        ok: true,
        query: q,
        count: results.length,
        results
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Search failed."
      });
    }
  }
);

/*
=====================================================
BRAND APPLICATION
=====================================================
*/

app.post(
  "/api/applications",
  rejectAdultContent,
  async (req, res) => {
    const brandName = cleanString(
      req.body.brand_name,
      200
    );

    const country = cleanString(
      req.body.country,
      200
    );

    const ownerName = cleanString(
      req.body.owner_name,
      200
    );

    const email = cleanString(
      req.body.email,
      254
    );

    const phone = cleanString(
      req.body.phone,
      100
    );

    const website = cleanString(
      req.body.website,
      2048
    );

    const logo = cleanString(
      req.body.logo,
      2048
    );

    const description = cleanString(
      req.body.description,
      5000
    );

    if (!brandName) {
      return res.status(400).json({
        ok: false,
        error: "Brand name is required."
      });
    }

    if (!email || !validEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: "Valid email is required."
      });
    }

    if (
      !validateUrls([
        website,
        logo
      ])
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid URL."
      });
    }

    try {
      const result = await dbRun(
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
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          "new"
        ]
      );

      res.status(201).json({
        ok: true,
        message:
          "Application submitted successfully.",
        id: result.lastID
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error:
          "Failed to submit application."
      });
    }
  }
);

/*
=====================================================
ADMIN API
=====================================================
*/

/*
GET APPLICATIONS
*/

app.get(
  "/api/admin/applications",
  adminAuth,
  async (req, res) => {
    try {
      const applications = await dbAll(`
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
          created_at
        FROM applications
        ORDER BY id DESC
      `);

      res.json({
        ok: true,
        applications
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error:
          "Failed to load applications."
      });
    }
  }
);

/*
GET ADMIN BRANDS
*/

app.get(
  "/api/admin/brands",
  adminAuth,
  async (req, res) => {
    try {
      const brands = await dbAll(`
        SELECT
          b.id,
          b.country_id,
          b.name,
          b.logo,
          b.category,
          b.description,
          b.website,
          b.verification,
          b.created_at,
          c.name AS country,
          c.code AS country_code
        FROM brands b
        JOIN countries c
          ON c.id = b.country_id
        ORDER BY b.id DESC
      `);

      res.json({
        ok: true,
        brands
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to load brands."
      });
    }
  }
);

/*
CREATE BRAND
*/

app.post(
  "/api/admin/brands",
  adminAuth,
  rejectAdultContent,
  async (req, res) => {
    const countryId =
      validId(req.body.country_id);

    const name = cleanString(
      req.body.name,
      200
    );

    const logo = cleanString(
      req.body.logo,
      2048
    );

    const category = cleanString(
      req.body.category,
      200
    );

    const description = cleanString(
      req.body.description,
      5000
    );

    const website = cleanString(
      req.body.website,
      2048
    );

    const verification = cleanString(
      req.body.verification,
      100
    ) || "Unverified";

    if (!countryId) {
      return res.status(400).json({
        ok: false,
        error: "Valid country_id is required."
      });
    }

    if (!name) {
      return res.status(400).json({
        ok: false,
        error: "Brand name is required."
      });
    }

    if (
      !validateUrls([
        logo,
        website
      ])
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid URL."
      });
    }

    try {
      const country = await dbGet(
        `
        SELECT id
        FROM countries
        WHERE id = ?
        `,
        [countryId]
      );

      if (!country) {
        return res.status(404).json({
          ok: false,
          error: "Country not found."
        });
      }

      const result = await dbRun(
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
          name,
          logo,
          category,
          description,
          website,
          verification
        ]
      );

      res.status(201).json({
        ok: true,
        message: "Brand created.",
        id: result.lastID
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to create brand."
      });
    }
  }
);

/*
UPDATE BRAND
*/

app.put(
  "/api/admin/brands/:id",
  adminAuth,
  rejectAdultContent,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid brand ID."
      });
    }

    const countryId =
      validId(req.body.country_id);

    const name = cleanString(
      req.body.name,
      200
    );

    const logo = cleanString(
      req.body.logo,
      2048
    );

    const category = cleanString(
      req.body.category,
      200
    );

    const description = cleanString(
      req.body.description,
      5000
    );

    const website = cleanString(
      req.body.website,
      2048
    );

    const verification = cleanString(
      req.body.verification,
      100
    ) || "Unverified";

    if (!countryId || !name) {
      return res.status(400).json({
        ok: false,
        error:
          "country_id and name are required."
      });
    }

    if (
      !validateUrls([
        logo,
        website
      ])
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid URL."
      });
    }

    try {
      const existing = await dbGet(
        `
        SELECT id
        FROM brands
        WHERE id = ?
        `,
        [id]
      );

      if (!existing) {
        return res.status(404).json({
          ok: false,
          error: "Brand not found."
        });
      }

      const country = await dbGet(
        `
        SELECT id
        FROM countries
        WHERE id = ?
        `,
        [countryId]
      );

      if (!country) {
        return res.status(404).json({
          ok: false,
          error: "Country not found."
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
          countryId,
          name,
          logo,
          category,
          description,
          website,
          verification,
          id
        ]
      );

      res.json({
        ok: true,
        message: "Brand updated."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to update brand."
      });
    }
  }
);

/*
DELETE BRAND
*/

app.delete(
  "/api/admin/brands/:id",
  adminAuth,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid brand ID."
      });
    }

    try {
      const result = await dbRun(
        `
        DELETE FROM brands
        WHERE id = ?
        `,
        [id]
      );

      if (result.changes === 0) {
        return res.status(404).json({
          ok: false,
          error: "Brand not found."
        });
      }

      res.json({
        ok: true,
        message: "Brand deleted."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Failed to delete brand."
      });
    }
  }
);

/*
UPDATE APPLICATION STATUS
*/

app.put(
  "/api/admin/applications/:id",
  adminAuth,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid application ID."
      });
    }

    const status = cleanString(
      req.body.status,
      30
    ).toLowerCase();

    const allowedStatuses = [
      "new",
      "reviewing",
      "approved",
      "rejected"
    ];

    if (
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid status. Use: new, reviewing, approved or rejected."
      });
    }

    try {
      const result = await dbRun(
        `
        UPDATE applications
        SET status = ?
        WHERE id = ?
        `,
        [
          status,
          id
        ]
      );

      if (result.changes === 0) {
        return res.status(404).json({
          ok: false,
          error: "Application not found."
        });
      }

      res.json({
        ok: true,
        message:
          "Application status updated."
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error:
          "Failed to update application."
      });
    }
  }
);

/*
=====================================================
UNKNOWN API ROUTE
=====================================================
*/

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,
      error: "API endpoint not found."
    });
  }
);

/*
=====================================================
ADMIN PAGE
=====================================================
*/

app.get(
  "/admin",
  adminAuth,
  (req, res) => {
    const adminIndex =
      path.join(
        ADMIN_DIR,
        "index.html"
      );

    if (!fs.existsSync(adminIndex)) {
      return res.status(404).send(
        "Admin page not found."
      );
    }

    res.sendFile(adminIndex);
  }
);

/*
=====================================================
ADMIN STATIC FILES
=====================================================
*/

app.use(
  "/admin",
  adminAuth,
  express.static(ADMIN_DIR)
);

/*
=====================================================
PUBLIC STATIC FILES
=====================================================
*/

app.use(
  express.static(PUBLIC_DIR, {
    index: "index.html"
  })
);

/*
=====================================================
FRONTEND FALLBACK
=====================================================
*/

app.get(
  /.*/,
  (req, res) => {
    const indexPath =
      path.join(
        PUBLIC_DIR,
        "index.html"
      );

    if (!fs.existsSync(indexPath)) {
      return res.status(404).send(
        "index.html not found."
      );
    }

    res.sendFile(indexPath);
  }
);

/*
=====================================================
ERROR HANDLER
=====================================================
*/

app.use(
  (error, req, res, next) => {
    console.error(
      "Server error:",
      error
    );

    if (
      error instanceof SyntaxError &&
      error.status === 400 &&
      "body" in error
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid JSON."
      });
    }

    res.status(500).json({
      ok: false,
      error: "Internal server error."
    });
  }
);

/*
=====================================================
START SERVER
=====================================================
*/

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          "========================================"
        );

        console.log(
          "ALL WORLD BRANDS"
        );

        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          `Database: ${DB_PATH}`
        );

        console.log(
          "========================================"
        );
      }
    );
  } catch (error) {
    console.error(
      "Database initialization failed:",
      error
    );

    process.exit(1);
  }
}

startServer();

/*
=====================================================
GRACEFUL SHUTDOWN
=====================================================
*/

function shutdown(signal) {
  console.log(
    `${signal} received. Closing database...`
  );

  db.close((error) => {
    if (error) {
      console.error(
        "Database close error:",
        error
      );

      process.exit(1);
    }

    console.log(
      "Database closed."
    );

    process.exit(0);
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
