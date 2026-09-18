const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(morgan("combined"));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

const db = new sqlite3.Database(
  path.join(__dirname, "allworldbrands.db")
);

/* =========================
   COUNTRIES + TERRITORIES
   ========================= */

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

/* =========================
   DATABASE
   ========================= */

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
      description TEXT,
      website TEXT,
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
      description TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const insertCountry = db.prepare(`
    INSERT OR IGNORE INTO countries (name, code)
    VALUES (?, ?)
  `);

  countries.forEach(([name, code]) => {
    insertCountry.run(name, code);
  });

  insertCountry.finalize();

  const starterBrands = [
    ["Apple", "United States", "Technology company", "https://www.apple.com"],
    ["Nike", "United States", "Sportswear brand", "https://www.nike.com"],
    ["Burberry", "United Kingdom", "Luxury fashion brand", "https://www.burberry.com"],
    ["BMW", "Germany", "Automobile manufacturer", "https://www.bmw.com"],
    ["L'Oréal", "France", "Beauty and cosmetics company", "https://www.loreal.com"],
    ["Ferrari", "Italy", "Automobile manufacturer", "https://www.ferrari.com"],
    ["Arçelik", "Turkey", "Home appliances", "https://www.arcelik.com"],
    ["Artel", "Uzbekistan", "Electronics and home appliances", "https://artelelectronics.com"],
    ["Toyota", "Japan", "Automobile manufacturer", "https://www.toyota.com"],
    ["Samsung", "South Korea", "Electronics company", "https://www.samsung.com"],
    ["Huawei", "China", "Technology company", "https://www.huawei.com"],
    ["Tata", "India", "Conglomerate", "https://www.tata.com"]
  ];

  starterBrands.forEach(([name, country, description, website]) => {
    db.get(
      `SELECT id FROM countries WHERE name = ?`,
      [country],
      (err, row) => {
        if (err || !row) return;

        db.run(
          `
          INSERT INTO brands
          (country_id, name, description, website)
          SELECT ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM brands
            WHERE country_id = ? AND name = ?
          )
          `,
          [
            row.id,
            name,
            description,
            website,
            row.id,
            name
          ]
        );
      }
    );
  });
});

/* =========================
   ADMIN AUTH
   ========================= */

function adminAuth(req, res, next) {
  const auth = req.headers.authorization || "";

  if (!auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="ALL WORLD BRANDS ADMIN"');
    return res.status(401).send("Authentication required");
  }

  const encoded = auth.slice(6);

  let decoded;

  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch (e) {
    return res.status(401).send("Invalid authentication");
  }

  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return res.status(401).send("Invalid authentication");
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  if (
    username !== process.env.ADMIN_USER ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    res.setHeader("WWW-Authenticate", 'Basic realm="ALL WORLD BRANDS ADMIN"');
    return res.status(401).send("Wrong username or password");
  }

  next();
}

/* =========================
   HEALTH
   ========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ALL WORLD BRANDS",
    countries: countries.length
  });
});

/* =========================
   PUBLIC API
   ========================= */

app.get("/api/countries", (req, res) => {
  db.all(
    `
    SELECT
      c.id,
      c.name,
      c.code,
      COUNT(b.id) AS brand_count
    FROM countries c
    LEFT JOIN brands b ON b.country_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      res.json(rows);
    }
  );
});

app.get("/api/countries/:id/brands", (req, res) => {
  db.all(
    `
    SELECT
      id,
      name,
      description,
      website,
      created_at
    FROM brands
    WHERE country_id = ?
    ORDER BY name COLLATE NOCASE
    `,
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      res.json(rows);
    }
  );
});

app.get("/api/brands/:id", (req, res) => {
  db.get(
    `
    SELECT
      b.id,
      b.name,
      b.description,
      b.website,
      b.created_at,
      c.name AS country,
      c.code AS country_code
    FROM brands b
    JOIN countries c ON c.id = b.country_id
    WHERE b.id = ?
    `,
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      if (!row) {
        return res.status(404).json({
          error: "Brand not found"
        });
      }

      res.json(row);
    }
  );
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.json([]);
  }

  const like = `%${q}%`;

  db.all(
    `
    SELECT
      b.id,
      b.name,
      b.description,
      b.website,
      c.id AS country_id,
      c.name AS country,
      c.code AS country_code
    FROM brands b
    JOIN countries c ON c.id = b.country_id
    WHERE
      b.name LIKE ?
      OR b.description LIKE ?
      OR c.name LIKE ?
    ORDER BY b.name COLLATE NOCASE
    LIMIT 100
    `,
    [like, like, like],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      res.json(rows);
    }
  );
});

/* =========================
   BRAND APPLICATION
   ========================= */

app.post("/api/applications", (req, res) => {
  const {
    brand_name,
    country,
    owner_name,
    email,
    phone,
    website,
    description
  } = req.body;

  if (!brand_name || !email) {
    return res.status(400).json({
      ok: false,
      error: "Brand name and email are required"
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
      description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      brand_name.trim(),
      country || "",
      owner_name || "",
      email.trim(),
      phone || "",
      website || "",
      description || ""
    ],
    function (err) {
      if (err) {
        console.error(err);

        return res.status(500).json({
          ok: false,
          error: "Could not save application"
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
});

/* =========================
   ADMIN API
   ========================= */

app.get("/api/admin/applications", adminAuth, (req, res) => {
  db.all(
    `
    SELECT *
    FROM applications
    ORDER BY id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      res.json(rows);
    }
  );
});

app.get("/api/admin/brands", adminAuth, (req, res) => {
  db.all(
    `
    SELECT
      b.id,
      b.name,
      b.description,
      b.website,
      c.id AS country_id,
      c.name AS country,
      c.code AS country_code
    FROM brands b
    JOIN countries c ON c.id = b.country_id
    ORDER BY b.id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: "Database error"
        });
      }

      res.json(rows);
    }
  );
});

app.post("/api/admin/brands", adminAuth, (req, res) => {
  const {
    country_id,
    name,
    description,
    website
  } = req.body;

  if (!country_id || !name) {
    return res.status(400).json({
      error: "Country and brand name are required"
    });
  }

  db.run(
    `
    INSERT INTO brands
    (
      country_id,
      name,
      description,
      website
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      country_id,
      name.trim(),
      description || "",
      website || ""
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: "Could not create brand"
        });
      }

      res.json({
        ok: true,
        id: this.lastID
      });
    }
  );
});

app.put("/api/admin/brands/:id", adminAuth, (req, res) => {
  const {
    country_id,
    name,
    description,
    website
  } = req.body;

  db.run(
    `
    UPDATE brands
    SET
      country_id = ?,
      name = ?,
      description = ?,
      website = ?
    WHERE id = ?
    `,
    [
      country_id,
      name,
      description || "",
      website || "",
      req.params.id
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: "Could not update brand"
        });
      }

      res.json({
        ok: true,
        changes: this.changes
      });
    }
  );
});

app.delete("/api/admin/brands/:id", adminAuth, (req, res) => {
  db.run(
    `
    DELETE FROM brands
    WHERE id = ?
    `,
    [req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: "Could not delete brand"
        });
      }

      res.json({
        ok: true,
        changes: this.changes
      });
    }
  );
});

app.put("/api/admin/applications/:id", adminAuth, (req, res) => {
  const { status } = req.body;

  const allowed = [
    "new",
    "reviewing",
    "approved",
    "rejected"
  ];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: "Invalid status"
    });
  }

  db.run(
    `
    UPDATE applications
    SET status = ?
    WHERE id = ?
    `,
    [status, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({
          error: "Could not update application"
        });
      }

      res.json({
        ok: true,
        changes: this.changes
      });
    }
  );
});

/* =========================
   ADMIN PAGE
   ========================= */

app.use(
  "/admin",
  adminAuth,
  express.static(path.join(__dirname, "public", "admin"))
);

/* =========================
   PUBLIC FILES
   ========================= */

app.use(
  express.static(path.join(__dirname, "public"))
);

/* =========================
   FALLBACK
   ========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

/* =========================
   START SERVER
   ========================= */

app.listen(PORT, () => {
  console.log("=================================");
  console.log("ALL WORLD BRANDS");
  console.log("Server running on port:", PORT);
  console.log("World entries loaded:", countries.length);
  console.log("=================================");
});
