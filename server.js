const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;

const DB_FILE =
  process.env.DB_FILE ||
  path.join(__dirname, "allworldbrands.db");

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");


// ==================================================
// DATABASE TABLES
// ==================================================

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
  owner_email TEXT NOT NULL,
  website TEXT,
  package TEXT DEFAULT 'Basic',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);


// ==================================================
// COUNTRIES
// ==================================================

const countries = [
  ["Afghanistan","AF"],
  ["Albania","AL"],
  ["Algeria","DZ"],
  ["Andorra","AD"],
  ["Angola","AO"],
  ["Argentina","AR"],
  ["Armenia","AM"],
  ["Australia","AU"],
  ["Austria","AT"],
  ["Azerbaijan","AZ"],
  ["Bahamas","BS"],
  ["Bahrain","BH"],
  ["Bangladesh","BD"],
  ["Belarus","BY"],
  ["Belgium","BE"],
  ["Belize","BZ"],
  ["Benin","BJ"],
  ["Bolivia","BO"],
  ["Bosnia and Herzegovina","BA"],
  ["Botswana","BW"],
  ["Brazil","BR"],
  ["Brunei","BN"],
  ["Bulgaria","BG"],
  ["Cambodia","KH"],
  ["Cameroon","CM"],
  ["Canada","CA"],
  ["Chile","CL"],
  ["China","CN"],
  ["Colombia","CO"],
  ["Costa Rica","CR"],
  ["Croatia","HR"],
  ["Cuba","CU"],
  ["Cyprus","CY"],
  ["Czech Republic","CZ"],
  ["Denmark","DK"],
  ["Dominican Republic","DO"],
  ["Ecuador","EC"],
  ["Egypt","EG"],
  ["Estonia","EE"],
  ["Ethiopia","ET"],
  ["Finland","FI"],
  ["France","FR"],
  ["Georgia","GE"],
  ["Germany","DE"],
  ["Ghana","GH"],
  ["Greece","GR"],
  ["Guatemala","GT"],
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
  ["Kuwait","KW"],
  ["Kyrgyzstan","KG"],
  ["Laos","LA"],
  ["Latvia","LV"],
  ["Lebanon","LB"],
  ["Libya","LY"],
  ["Lithuania","LT"],
  ["Luxembourg","LU"],
  ["Malaysia","MY"],
  ["Maldives","MV"],
  ["Malta","MT"],
  ["Mauritius","MU"],
  ["Mexico","MX"],
  ["Moldova","MD"],
  ["Monaco","MC"],
  ["Mongolia","MN"],
  ["Montenegro","ME"],
  ["Morocco","MA"],
  ["Mozambique","MZ"],
  ["Myanmar","MM"],
  ["Namibia","NA"],
  ["Nepal","NP"],
  ["Netherlands","NL"],
  ["New Zealand","NZ"],
  ["Nicaragua","NI"],
  ["Nigeria","NG"],
  ["North Macedonia","MK"],
  ["Norway","NO"],
  ["Oman","OM"],
  ["Pakistan","PK"],
  ["Panama","PA"],
  ["Paraguay","PY"],
  ["Peru","PE"],
  ["Philippines","PH"],
  ["Poland","PL"],
  ["Portugal","PT"],
  ["Qatar","QA"],
  ["Romania","RO"],
  ["Russia","RU"],
  ["Rwanda","RW"],
  ["Saudi Arabia","SA"],
  ["Senegal","SN"],
  ["Serbia","RS"],
  ["Singapore","SG"],
  ["Slovakia","SK"],
  ["Slovenia","SI"],
  ["South Africa","ZA"],
  ["South Korea","KR"],
  ["Spain","ES"],
  ["Sri Lanka","LK"],
  ["Sudan","SD"],
  ["Sweden","SE"],
  ["Switzerland","CH"],
  ["Syria","SY"],
  ["Taiwan","TW"],
  ["Tajikistan","TJ"],
  ["Tanzania","TZ"],
  ["Thailand","TH"],
  ["Tunisia","TN"],
  ["Türkiye","TR"],
  ["Turkmenistan","TM"],
  ["Uganda","UG"],
  ["Ukraine","UA"],
  ["United Arab Emirates","AE"],
  ["United Kingdom","GB"],
  ["United States","US"],
  ["Uruguay","UY"],
  ["Uzbekistan","UZ"],
  ["Venezuela","VE"],
  ["Vietnam","VN"],
  ["Yemen","YE"],
  ["Zambia","ZM"],
  ["Zimbabwe","ZW"]
];

const insertCountry = db.prepare(`
  INSERT OR IGNORE INTO countries
  (name, code)
  VALUES (?, ?)
`);

const insertCountries = db.transaction((items) => {
  for (const item of items) {
    insertCountry.run(item[0], item[1]);
  }
});

insertCountries(countries);


// ==================================================
// STARTER BRANDS
// ==================================================

const seedBrands = [
  ["US","Apple","Electronics","Technology brand profile.","https://www.apple.com"],
  ["US","Nike","Sports","Sportswear brand profile.","https://www.nike.com"],
  ["GB","Burberry","Luxury","British luxury fashion brand.","https://www.burberry.com"],
  ["DE","BMW","Automotive","German automotive brand.","https://www.bmw.com"],
  ["FR","L'Oréal","Cosmetics","Beauty brand profile.","https://www.loreal.com"],
  ["IT","Ferrari","Automotive","Italian automotive brand.","https://www.ferrari.com"],
  ["TR","Arçelik","Home","Home appliances brand.","https://www.arcelik.com.tr"],
  ["UZ","Artel","Electronics","Uzbek consumer electronics brand.","https://artelelectronics.com"],
  ["JP","Toyota","Automotive","Japanese automotive brand.","https://global.toyota"],
  ["KR","Samsung","Electronics","Technology brand.","https://www.samsung.com"],
  ["CN","Huawei","Electronics","Technology brand.","https://www.huawei.com"],
  ["IN","Tata","Industrial","Business group profile.","https://www.tata.com"]
];

const insertBrand = db.prepare(`
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
`);

const brandCount = db
  .prepare("SELECT COUNT(*) AS count FROM brands")
  .get()
  .count;

if (brandCount === 0) {

  const getCountry = db.prepare(`
    SELECT id
    FROM countries
    WHERE code = ?
  `);

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
}


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(morgan("tiny"));

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);


// ==================================================
// ADMIN AUTHENTICATION
// ==================================================

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
    auth.split(" ")[1];

  let decoded;

  try {

    decoded = Buffer
      .from(encoded, "base64")
      .toString("utf8");

  } catch (error) {

    return res
      .status(401)
      .send("Invalid authentication.");

  }

  const separator =
    decoded.indexOf(":");

  if (separator === -1) {

    return res
      .status(401)
      .send("Invalid authentication.");

  }

  const username =
    decoded.slice(0, separator);

  const password =
    decoded.slice(separator + 1);

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


// ==================================================
// PUBLIC WEBSITE
// ==================================================

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// ==================================================
// ADMIN PAGE
// ==================================================

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


// ==================================================
// API HEALTH
// ==================================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      service: "ALL WORLD BRANDS API"
    });

  }
);


// ==================================================
// COUNTRIES API
// ==================================================

app.get(
  "/api/countries",
  (req, res) => {

    try {

      const rows = db
        .prepare(`
          SELECT *
          FROM countries
          ORDER BY name COLLATE NOCASE
        `)
        .all();

      res.json(rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to load countries"
      });

    }

  }
);


// ==================================================
// COUNTRY BRANDS
// ==================================================

app.get(
  "/api/countries/:id/brands",
  (req, res) => {

    try {

      const rows = db
        .prepare(`
          SELECT *
          FROM brands
          WHERE country_id = ?
          ORDER BY name COLLATE NOCASE
        `)
        .all(req.params.id);

      res.json(rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to load country brands"
      });

    }

  }
);


// ==================================================
// SINGLE BRAND
// ==================================================

app.get(
  "/api/brands/:id",
  (req, res) => {

    try {

      const brand = db
        .prepare(`
          SELECT
            b.*,
            c.name AS country,
            c.code AS country_code
          FROM brands b
          JOIN countries c
            ON c.id = b.country_id
          WHERE b.id = ?
        `)
        .get(req.params.id);

      if (!brand) {

        return res.status(404).json({
          error: "Brand not found"
        });

      }

      brand.factories = db
        .prepare(`
          SELECT *
          FROM factories
          WHERE brand_id = ?
          ORDER BY name
        `)
        .all(req.params.id);

      res.json(brand);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to load brand"
      });

    }

  }
);


// ==================================================
// SEARCH API
// ==================================================

app.get(
  "/api/search",
  (req, res) => {

    try {

      const q =
        String(req.query.q || "")
          .trim();

      if (!q) {
        return res.json([]);
      }

      const s = `%${q}%`;

      const rows = db
        .prepare(`
          SELECT
            b.id,
            b.name,
            b.category,
            b.description,
            b.website,
            b.verification,
            c.name AS country,
            c.code AS country_code
          FROM brands b
          JOIN countries c
            ON c.id = b.country_id
          WHERE b.name LIKE ?
             OR b.category LIKE ?
             OR b.description LIKE ?
             OR c.name LIKE ?
          ORDER BY b.name COLLATE NOCASE
          LIMIT 50
        `)
        .all(s, s, s, s);

      res.json(rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Search failed"
      });

    }

  }
);


// ==================================================
// APPLICATIONS — PUBLIC
// ==================================================

app.post(
  "/api/applications",
  (req, res) => {

    try {

      const {
        brand_name,
        country,
        owner_email,
        website,
        package: packageName
      } = req.body || {};

      if (!brand_name) {

        return res.status(400).json({
          error: "Brand name is required"
        });

      }

      if (!country) {

        return res.status(400).json({
          error: "Country is required"
        });

      }

      if (!owner_email) {

        return res.status(400).json({
          error: "Owner email is required"
        });

      }

      const result = db
        .prepare(`
          INSERT INTO applications
          (
            brand_name,
            country,
            owner_email,
            website,
            package,
            status
          )
          VALUES (?, ?, ?, ?, ?, 'pending')
        `)
        .run(
          String(brand_name).trim(),
          String(country).trim(),
          String(owner_email).trim(),
          String(website || "").trim(),
          String(packageName || "Basic").trim()
        );

      res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        id: result.lastInsertRowid
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to submit application"
      });

    }

  }
);


// ==================================================
// ADMIN — GET ALL BRANDS
// ==================================================

app.get(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {

    try {

      const rows = db
        .prepare(`
          SELECT
            b.id,
            b.name,
            b.category,
            b.description,
            b.website,
            b.verification,
            c.name AS country,
            c.code AS country_code
          FROM brands b
          JOIN countries c
            ON c.id = b.country_id
          ORDER BY b.name COLLATE NOCASE
        `)
        .all();

      res.json(rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to load brands"
      });

    }

  }
);


// ==================================================
// ADMIN — ADD BRAND
// ==================================================

app.post(
  "/api/admin/brands",
  adminAuth,
  (req, res) => {

    try {

      const {
        name,
        country_code,
        category,
        description,
        website,
        verification
      } = req.body || {};

      if (!name) {

        return res.status(400).json({
          error: "Brand name is required"
        });

      }

      if (!country_code) {

        return res.status(400).json({
          error: "Country code is required"
        });

      }

      const code =
        String(country_code)
          .trim()
          .toUpperCase();

      const country = db
        .prepare(`
          SELECT id, name, code
          FROM countries
          WHERE code = ?
        `)
        .get(code);

      if (!country) {

        return res.status(400).json({
          error: "Country code not found: " + code
        });

      }

      const result = db
        .prepare(`
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
        `)
        .run(
          country.id,
          String(name).trim(),
          String(category || "").trim(),
          String(description || "").trim(),
          String(website || "").trim(),
          String(
            verification || "Unverified"
          ).trim()
        );

      res.status(201).json({
        success: true,
        message: "Brand added successfully",
        id: result.lastInsertRowid
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to add brand"
      });

    }

  }
);


// ==================================================
// ADMIN — DELETE BRAND
// ==================================================

app.delete(
  "/api/admin/brands/:id",
  adminAuth,
  (req, res) => {

    try {

      const brandId = req.params.id;

      const brand = db
        .prepare(`
          SELECT id
          FROM brands
          WHERE id = ?
        `)
        .get(brandId);

      if (!brand) {

        return res.status(404).json({
          error: "Brand not found"
        });

      }

      db.prepare(`
        DELETE FROM factories
        WHERE brand_id = ?
      `).run(brandId);

      db.prepare(`
        DELETE FROM brands
        WHERE id = ?
      `).run(brandId);

      res.json({
        success: true,
        message: "Brand deleted successfully"
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to delete brand"
      });

    }

  }
);


// ==================================================
// ADMIN — GET APPLICATIONS
// ==================================================

app.get(
  "/api/admin/applications",
  adminAuth,
  (req, res) => {

    try {

      const rows = db
        .prepare(`
          SELECT *
          FROM applications
          ORDER BY id DESC
        `)
        .all();

      res.json(rows);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to load applications"
      });

    }

  }
);


// ==================================================
// ADMIN — UPDATE APPLICATION STATUS
// ==================================================

app.patch(
  "/api/admin/applications/:id",
  adminAuth,
  (req, res) => {

    try {

      const {
        status
      } = req.body || {};

      if (!status) {

        return res.status(400).json({
          error: "Status is required"
        });

      }

      const allowedStatuses = [
        "pending",
        "approved",
        "rejected"
      ];

      if (
        !allowedStatuses.includes(
          String(status)
        )
      ) {

        return res.status(400).json({
          error: "Invalid status"
        });

      }

      const result = db
        .prepare(`
          UPDATE applications
          SET status = ?
          WHERE id = ?
        `)
        .run(
          String(status),
          req.params.id
        );

      if (result.changes === 0) {

        return res.status(404).json({
          error: "Application not found"
        });

      }

      res.json({
        success: true,
        message: "Application updated successfully"
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to update application"
      });

    }

  }
);


// ==================================================
// ADMIN — DELETE APPLICATION
// ==================================================

app.delete(
  "/api/admin/applications/:id",
  adminAuth,
  (req, res) => {

    try {

      const result = db
        .prepare(`
          DELETE FROM applications
          WHERE id = ?
        `)
        .run(req.params.id);

      if (result.changes === 0) {

        return res.status(404).json({
          error: "Application not found"
        });

      }

      res.json({
        success: true,
        message: "Application deleted successfully"
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error: "Failed to delete application"
      });

    }

  }
);


// ==================================================
// PUBLIC WEBSITE FALLBACK
// ==================================================

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


// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `ALL WORLD BRANDS running on port ${PORT}`
    );

  }
);
