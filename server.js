const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   DATABASE
========================= */

const db = new Database(
  path.join(__dirname, "allworldbrands.db")
);

db.pragma("journal_mode = WAL");

/* =========================
   TABLES
========================= */

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

/* =========================
   COUNTRIES
========================= */

const countries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe"
];

const insertCountry = db.prepare(`
  INSERT OR IGNORE INTO countries (name)
  VALUES (?)
`);

const insertCountries = db.transaction(() => {
  for (const country of countries) {
    insertCountry.run(country);
  }
});

insertCountries();

/* =========================
   STARTER BRANDS
========================= */

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

const findCountry = db.prepare(`
  SELECT id FROM countries WHERE name = ?
`);

const insertBrand = db.prepare(`
  INSERT INTO brands
  (name, country_id)
  VALUES (?, ?)
`);

for (const [brandName, countryName] of starterBrands) {
  const country = findCountry.get(countryName);

  if (country) {
    const exists = db
      .prepare(`
        SELECT id
        FROM brands
        WHERE name = ?
      `)
      .get(brandName);

    if (!exists) {
      insertBrand.run(
        brandName,
        country.id
      );
    }
  }
}

/* =========================
   MIDDLEWARE
========================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(morgan("combined"));

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

/* =========================
   ADMIN AUTH
========================= */

const ADMIN_USER =
  process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

function adminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res
      .status(500)
      .send("Admin password is not configured.");
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
    decoded = Buffer
      .from(encoded, "base64")
      .toString("utf8");
  } catch (error) {
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
      .send("Wrong username or password.");
  }

  next();
}

/* =========================
   ADMIN PAGE
========================= */

app.get(
  "/admin",
  adminAuth,
  (req, res) => {
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

/* =========================
   ADMIN STATIC
========================= */

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

/* =========================
   PUBLIC STATIC
========================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "ALL WORLD BRANDS"
    });
  }
);

/* =========================
   COUNTRIES
========================= */

app.get(
  "/api/countries",
  (req, res) => {
    const rows = db
      .prepare(`
        SELECT *
        FROM countries
        ORDER BY name ASC
      `)
      .all();

    res.json(rows);
  }
);

/* =========================
   BRANDS BY COUNTRY
========================= */

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
          ON brands.country_id = countries.id
        WHERE brands.country_id = ?
        ORDER BY brands.name ASC
      `)
      .all(req.params.id);

    res.json(rows);
  }
);

/* =========================
   BRAND DETAILS
========================= */

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
          ON brands.country_id = countries.id
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

    res.json(brand);
  }
);

/* =========================
   SEARCH
========================= */

app.get(
  "/api/search",
  (req, res) => {
    const q =
      String(req.query.q || "")
        .trim();

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
          brands.description,
          brands.website,
          brands.logo,
          countries.name AS country_name
        FROM brands
        LEFT JOIN countries
          ON brands.country_id = countries.id
        WHERE
          brands.name LIKE ?
          OR countries.name LIKE ?
        ORDER BY brands.name ASC
        LIMIT 100
      `)
      .all(
        search,
        search
      );

    res.json(rows);
  }
);

/* =========================
   APPLICATION
========================= */

app.post(
  "/api/applications",
  (req, res) => {
    const {
      name,
      email,
      phone,
      message
    } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({
          error:
            "Name and email are required."
        });
    }

    const result = db
      .prepare(`
        INSERT INTO applications
        (name, email, phone, message)
        VALUES (?, ?, ?, ?)
      `)
      .run(
        name,
        email,
        phone || "",
        message || ""
      );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  }
);

/* =========================
   ADMIN BRANDS
========================= */

app.get(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {
    const rows = db
      .prepare(`
        SELECT
          brands.*,
          countries.name AS country_name
        FROM brands
        LEFT JOIN countries
          ON brands.country_id = countries.id
        ORDER BY brands.id DESC
      `)
      .all();

    res.json(rows);
  }
);

/* =========================
   ADD BRAND
========================= */

app.post(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {
    const {
      name,
      country_id,
      description,
      website,
      logo
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({
          error:
            "Brand name is required."
        });
    }

    const result = db
      .prepare(`
        INSERT INTO brands
        (
          name,
          country_id,
          description,
          website,
          logo
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        name,
        country_id || null,
        description || "",
        website || "",
        logo || ""
      );

    res.json({
      success: true,
      id: result.lastInsertRowid
    });
  }
);

/* =========================
   DELETE BRAND
========================= */

app.delete(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {
    db
      .prepare(`
        DELETE FROM brands
        WHERE id = ?
      `)
      .run(req.params.id);

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN APPLICATIONS
========================= */

app.get(
  "/api/admin/applications",
  adminAuth,
  (req, res) => {
    const rows = db
      .prepare(`
        SELECT *
        FROM applications
        ORDER BY id DESC
      `)
      .all();

    res.json(rows);
  }
);

/* =========================
   UPDATE APPLICATION
========================= */

app.patch(
  "/api/admin/applications/:id",
  adminAuth,
  (req, res) => {
    const {
      status
    } = req.body;

    db
      .prepare(`
        UPDATE applications
        SET status = ?
        WHERE id = ?
      `)
      .run(
        status || "new",
        req.params.id
      );

    res.json({
      success: true
    });
  }
);

/* =========================
   DELETE APPLICATION
========================= */

app.delete(
  "/api/admin/applications/:id",
  adminAuth,
  (req, res) => {
    db
      .prepare(`
        DELETE FROM applications
        WHERE id = ?
      `)
      .run(req.params.id);

    res.json({
      success: true
    });
  }
);

/* =========================
   PUBLIC FALLBACK
========================= */

app.get(
  "*",
  (req, res, next) => {
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/admin")
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

/* =========================
   404
========================= */

app.use(
  (req, res) => {
    res
      .status(404)
      .send("Not found.");
  }
);

/* =========================
   ERROR HANDLER
========================= */

app.use(
  (err, req, res, next) => {
    console.error(err);

    res
      .status(500)
      .json({
        error: "Server error"
      });
  }
);

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ALL WORLD BRANDS running on port ${PORT}`
    );
  }
);
