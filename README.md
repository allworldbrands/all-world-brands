ALL WORLD BRANDS
Global directory for countries, territories and brands.
Stack
Node.js 22
Express 5
better-sqlite3
HTML/CSS/JavaScript frontend
Run
npm install
npm start
Open http://localhost:3000.
Environment
Copy .env.example to .env and configure the values. In production, keep administrator credentials in environment variables and never commit them to Git.
Admin
/admin uses HTTP Basic Authentication from ADMIN_USER and ADMIN_PASSWORD.
Brand submissions and payment
Brand applications are created server-side as unpaid.
The browser cannot submit a trusted payment_status.
The service fee is $1 USD.
Payment transactions are stored server-side.
The included demo acquiring page is for testing only and does not charge real money.
A real bank/acquiring provider can replace the demo checkout while keeping the same server-side verification architecture.
Important frontend behavior
If a visitor starts payment and uses the browser Back button without paying, the submission button is restored immediately to Continue to payment — $1 and the payment state is cleared.
Assets
Country images are under public/images/countries/. The main visual background is public/earth-4k.png.
Production payment note
The project keeps payment confirmation server-side. The included demo provider is for testing only and does not charge real money. Before production launch, set up a supported bank/acquiring provider and implement its server-to-server create/return/webhook verification using environment variables only. Never put merchant secrets in the frontend or Git repository.
Admin security
The admin page is served only through /admin after HTTP Basic Authentication using ADMIN_USER and ADMIN_PASSWORD. The admin HTML file is outside public/ so it is not directly exposed as a static asset.
