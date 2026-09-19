const fs = require("fs");
const path = require("path");
const https = require("https");

const OUTPUT_DIR = path.join(
  __dirname,
  "public",
  "images",
  "countries"
);

const API_URL =
  "https://commons.wikimedia.org/w/api.php";

const USER_AGENT =
  "ALL-WORLD-BRANDS/1.0 country-image-downloader";

const countries = [
  ["Afghanistan", "AF"],
  ["Albania", "AL"],
  ["Algeria", "DZ"],
  ["Andorra", "AD"],
  ["Angola", "AO"],
  ["Antigua and Barbuda", "AG"],
  ["Argentina", "AR"],
  ["Armenia", "AM"],
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
  ["Bhutan", "BT"],
  ["Bolivia", "BO"],
  ["Bosnia and Herzegovina", "BA"],
  ["Botswana", "BW"],
  ["Brazil", "BR"],
  ["Brunei", "BN"],
  ["Bulgaria", "BG"],
  ["Burkina Faso", "BF"],
  ["Burundi", "BI"],
  ["Cabo Verde", "CV"],
  ["Cambodia", "KH"],
  ["Cameroon", "CM"],
  ["Canada", "CA"],
  ["Central African Republic", "CF"],
  ["Chad", "TD"],
  ["Chile", "CL"],
  ["China", "CN"],
  ["Colombia", "CO"],
  ["Comoros", "KM"],
  ["Congo", "CG"],
  ["Costa Rica", "CR"],
  ["Côte d'Ivoire", "CI"],
  ["Croatia", "HR"],
  ["Cuba", "CU"],
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
  ["Fiji", "FJ"],
  ["Finland", "FI"],
  ["France", "FR"],
  ["Gabon", "GA"],
  ["Gambia", "GM"],
  ["Georgia", "GE"],
  ["Germany", "DE"],
  ["Ghana", "GH"],
  ["Greece", "GR"],
  ["Grenada", "GD"],
  ["Guatemala", "GT"],
  ["Guinea", "GN"],
  ["Guinea-Bissau", "GW"],
  ["Guyana", "GY"],
  ["Haiti", "HT"],
  ["Honduras", "HN"],
  ["Hungary", "HU"],
  ["Iceland", "IS"],
  ["India", "IN"],
  ["Indonesia", "ID"],
  ["Iran", "IR"],
  ["Iraq", "IQ"],
  ["Ireland", "IE"],
  ["Israel", "IL"],
  ["Italy", "IT"],
  ["Jamaica", "JM"],
  ["Japan", "JP"],
  ["Jordan", "JO"],
  ["Kazakhstan", "KZ"],
  ["Kenya", "KE"],
  ["Kiribati", "KI"],
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
  ["Madagascar", "MG"],
  ["Malawi", "MW"],
  ["Malaysia", "MY"],
  ["Maldives", "MV"],
  ["Mali", "ML"],
  ["Malta", "MT"],
  ["Marshall Islands", "MH"],
  ["Mauritania", "MR"],
  ["Mauritius", "MU"],
  ["Mexico", "MX"],
  ["Micronesia", "FM"],
  ["Moldova", "MD"],
  ["Monaco", "MC"],
  ["Mongolia", "MN"],
  ["Montenegro", "ME"],
  ["Morocco", "MA"],
  ["Mozambique", "MZ"],
  ["Myanmar", "MM"],
  ["Namibia", "NA"],
  ["Nauru", "NR"],
  ["Nepal", "NP"],
  ["Netherlands", "NL"],
  ["New Zealand", "NZ"],
  ["Nicaragua", "NI"],
  ["Niger", "NE"],
  ["Nigeria", "NG"],
  ["North Macedonia", "MK"],
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
  ["Poland", "PL"],
  ["Portugal", "PT"],
  ["Qatar", "QA"],
  ["Romania", "RO"],
  ["Russia", "RU"],
  ["Rwanda", "RW"],
  ["Saint Lucia", "LC"],
  ["Saint Kitts and Nevis", "KN"],
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
  ["Slovakia", "SK"],
  ["Slovenia", "SI"],
  ["Solomon Islands", "SB"],
  ["Somalia", "SO"],
  ["South Africa", "ZA"],
  ["South Korea", "KR"],
  ["South Sudan", "SS"],
  ["Spain", "ES"],
  ["Sri Lanka", "LK"],
  ["Sudan", "SD"],
  ["Suriname", "SR"],
  ["Sweden", "SE"],
  ["Switzerland", "CH"],
  ["Syria", "SY"],
  ["Taiwan", "TW"],
  ["Tajikistan", "TJ"],
  ["Tanzania", "TZ"],
  ["Thailand", "TH"],
  ["Timor-Leste", "TL"],
  ["Togo", "TG"],
  ["Tonga", "TO"],
  ["Trinidad and Tobago", "TT"],
  ["Tunisia", "TN"],
  ["Turkey", "TR"],
  ["Turkmenistan", "TM"],
  ["Tuvalu", "TV"],
  ["Uganda", "UG"],
  ["Ukraine", "UA"],
  ["United Arab Emirates", "AE"],
  ["United Kingdom", "GB"],
  ["United States", "US"],
  ["Uruguay", "UY"],
  ["Uzbekistan", "UZ"],
  ["Vanuatu", "VU"],
  ["Venezuela", "VE"],
  ["Vietnam", "VN"],
  ["Yemen", "YE"],
  ["Zambia", "ZM"],
  ["Zimbabwe", "ZW"]
];

const specialSearches = {
  UZ: "Registan Samarkand Uzbekistan",
  US: "Statue of Liberty New York",
  GB: "Big Ben London",
  FR: "Eiffel Tower Paris",
  DE: "Brandenburg Gate Berlin",
  IT: "Colosseum Rome",
  TR: "Hagia Sophia Istanbul",
  JP: "Mount Fuji Japan",
  CN: "Great Wall China",
  IN: "Taj Mahal India",
  AE: "Burj Khalifa Dubai",
  EG: "Pyramids Giza Egypt",
  BR: "Christ the Redeemer Rio",
  AU: "Sydney Opera House Australia",
  CA: "Toronto skyline Canada",
  ES: "Sagrada Familia Barcelona",
  GR: "Acropolis Athens",
  RU: "Saint Basil Cathedral Moscow",
  KR: "Seoul South Korea",
  SG: "Marina Bay Sands Singapore",
  MY: "Petronas Towers Kuala Lumpur",
  TH: "Grand Palace Bangkok",
  ID: "Borobudur Indonesia",
  MX: "Chichen Itza Mexico",
  NL: "Amsterdam Netherlands",
  CH: "Matterhorn Switzerland",
  AT: "Vienna Austria",
  PT: "Belem Tower Lisbon",
  SE: "Stockholm Sweden",
  NO: "Oslo Norway",
  DK: "Copenhagen Denmark",
  FI: "Helsinki Finland",
  IS: "Iceland landscape",
  NZ: "Milford Sound New Zealand",
  ZA: "Table Mountain Cape Town",
  MA: "Hassan II Mosque Morocco",
  SA: "Masjid al-Haram Mecca",
  QA: "Doha Qatar",
  KZ: "Astana Kazakhstan",
  KG: "Kyrgyzstan mountains",
  TJ: "Dushanbe Tajikistan",
  TM: "Ashgabat Turkmenistan"
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function apiRequest(params) {
  return new Promise((resolve, reject) => {

    const query = new URLSearchParams({
      ...params,
      format: "json",
      origin: "*"
    });

    const url =
      `${API_URL}?${query.toString()}`;

    https.get(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT
        }
      },
      (response) => {

        let data = "";

        response.on(
          "data",
          (chunk) => {
            data += chunk;
          }
        );

        response.on(
          "end",
          () => {

            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }

          }
        );

      }
    ).on(
      "error",
      reject
    );
  });
}

function downloadFile(url, output) {
  return new Promise((resolve, reject) => {

    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT
        }
      },
      (response) => {

        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {

          return downloadFile(
            response.headers.location,
            output
          )
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {

          response.resume();

          return reject(
            new Error(
              `HTTP ${response.statusCode}`
            )
          );
        }

        const file =
          fs.createWriteStream(output);

        response.pipe(file);

        file.on(
          "finish",
          () => {

            file.close(
              () => resolve()
            );

          }
        );

        file.on(
          "error",
          (error) => {

            fs.unlink(
              output,
              () => {}
            );

            reject(error);
          }
        );
      }
    );

    request.on(
      "error",
      reject
    );
  });
}

function getLicense(info) {

  const metadata =
    info.extmetadata || {};

  const license =
    String(
      metadata.LicenseShortName?.value ||
      ""
    ).toLowerCase();

  const copyright =
    String(
      metadata.Copyrighted?.value ||
      ""
    ).toLowerCase();

  if (
    license.includes("cc by") ||
    license.includes("cc0") ||
    license.includes("public domain") ||
    copyright === "false"
  ) {
    return true;
  }

  return false;
}

async function searchImage(
  country,
  code
) {

  const query =
    specialSearches[code] ||
    `${country} landmark`;

  const result =
    await apiRequest({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "10",
      prop: "imageinfo",
      iiprop:
        "url|mime|size|extmetadata",
      iiurlwidth: "700"
    });

  if (
    !result.query ||
    !result.query.pages
  ) {
    return null;
  }

  const pages =
    Object.values(
      result.query.pages
    );

  for (const page of pages) {

    if (!page.imageinfo) {
      continue;
    }

    const info =
      page.imageinfo[0];

    if (!info.url) {
      continue;
    }

    const mime =
      String(info.mime || "")
        .toLowerCase();

    if (
      !mime.startsWith("image/")
    ) {
      continue;
    }

    if (!getLicense(info)) {
      continue;
    }

    return {
      title: page.title,
      url: info.url,
      thumbnail:
        info.thumburl || info.url,
      license:
        info.extmetadata
          ?.LicenseShortName
          ?.value || "Unknown"
    };
  }

  return null;
}

async function processCountry(
  country,
  code
) {

  const filename =
    `${code.toUpperCase()}.jpg`;

  const output =
    path.join(
      OUTPUT_DIR,
      filename
    );

  if (fs.existsSync(output)) {

    console.log(
      `SKIP  ${code} - ${country}`
    );

    return;
  }

  console.log(
    `SEARCH ${code} - ${country}`
  );

  try {

    const image =
      await searchImage(
        country,
        code
      );

    if (!image) {

      console.log(
        `NO IMAGE ${code} - ${country}`
      );

      return;
    }

    await downloadFile(
      image.thumbnail,
      output
    );

    console.log(
      `SAVED ${code} - ${country} - ${image.license}`
    );

  } catch (error) {

    console.log(
      `ERROR ${code} - ${country}:`,
      error.message
    );
  }
}

async function main() {

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    " ALL WORLD BRANDS"
  );
  console.log(
    " COUNTRY IMAGE DOWNLOADER"
  );
  console.log(
    "=========================================="
  );
  console.log(
    `Output: ${OUTPUT_DIR}`
  );
  console.log(
    `Countries: ${countries.length}`
  );
  console.log(
    "=========================================="
  );
  console.log("");

  let completed = 0;

  for (
    const [country, code]
    of countries
  ) {

    await processCountry(
      country,
      code
    );

    completed++;

    console.log(
      `Progress: ${completed}/${countries.length}`
    );

    /*
      Wikimedia serveriga juda ko‘p
      ketma-ket so‘rov yubormaslik uchun
      kichik tanaffus.
    */
    await sleep(700);
  }

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    " DOWNLOAD FINISHED"
  );
  console.log(
    "=========================================="
  );
  console.log(
    "Images:",
    OUTPUT_DIR
  );
  console.log("");
}

main().catch(
  (error) => {

    console.error(
      "FATAL ERROR:",
      error
    );

    process.exit(1);
  }
);
