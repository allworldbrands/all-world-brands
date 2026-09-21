const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const OCTO_SHOP_ID = Number(process.env.OCTO_SHOP_ID || 43051);
const OCTO_SECRET = process.env.OCTO_SECRET || "";

const OCTO_API_URL =
    "https://secure.octo.uz/prepare_payment";

const PUBLIC_BASE_URL =
    process.env.PUBLIC_BASE_URL ||
    "https://allworldbrands.net";

const OCTO_TEST =
    String(process.env.OCTO_TEST || "true").toLowerCase() === "true";

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(morgan("combined"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "ALL WORLD BRANDS",
        payment: "OCTO"
    });
});


/* =========================
   OCTO CREATE PAYMENT
========================= */

app.post("/api/payments/octo/create", async (req, res) => {

    try {

        if (!OCTO_SECRET) {
            return res.status(500).json({
                error: "OCTO_SECRET is not configured"
            });
        }

        const transactionId =
            crypto.randomUUID();

        const initTime =
            new Date()
                .toISOString()
                .replace("T", " ")
                .replace(/\.\d{3}Z$/, "");

        const payload = {

            octo_shop_id: OCTO_SHOP_ID,

            octo_secret: OCTO_SECRET,

            shop_transaction_id: transactionId,

            auto_capture: true,

            test: OCTO_TEST,

            init_time: initTime,

            total_sum: 1,

            currency: "USD",

            description:
                "ALL WORLD BRANDS PAYMENT",

            basket: [
                {
                    position_desc:
                        "ALL WORLD BRANDS",

                    count: 1,

                    price: 1
                }
            ],

            payment_methods: [
                {
                    method: "bank_card"
                }
            ],

            return_url:
                `${PUBLIC_BASE_URL}/payment-success.html?transaction=${encodeURIComponent(transactionId)}`,

            notify_url:
                `${PUBLIC_BASE_URL}/api/octo/notify`,

            language: "uz",

            ttl: 15
        };


        const response = await fetch(
            OCTO_API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(payload)
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "OCTO HTTP ERROR:",
                data
            );

            return res.status(502).json({
                error:
                    "OCTO server error"
            });
        }


        if (
            data.error !== undefined &&
            Number(data.error) !== 0
        ) {

            console.error(
                "OCTO API ERROR:",
                data
            );

            return res.status(400).json({
                error:
                    data.errMessage ||
                    data.errorMessage ||
                    "OCTO payment creation failed"
            });
        }


        const paymentUrl =
            data?.data?.octo_pay_url ||
            data?.octo_pay_url ||
            data?.data?.payment_url ||
            data?.payment_url;


        if (!paymentUrl) {

            console.error(
                "OCTO RESPONSE:",
                data
            );

            return res.status(502).json({
                error:
                    "OCTO payment URL was not returned"
            });
        }


        res.json({

            ok: true,

            transaction_id:
                transactionId,

            payment_url:
                paymentUrl

        });

    } catch (error) {

        console.error(
            "OCTO CREATE ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Unable to create OCTO payment"
        });
    }
});


/* =========================
   OCTO STATUS CHECK
========================= */

app.get(
    "/api/payments/octo/status/:transactionId",
    async (req, res) => {

        try {

            if (!OCTO_SECRET) {
                return res.status(500).json({
                    error:
                        "OCTO_SECRET is not configured"
                });
            }

            const transactionId =
                req.params.transactionId;


            const response =
                await fetch(
                    OCTO_API_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            octo_shop_id:
                                OCTO_SHOP_ID,

                            octo_secret:
                                OCTO_SECRET,

                            shop_transaction_id:
                                transactionId

                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                return res.status(502).json({
                    error:
                        "OCTO status request failed"
                });
            }


            res.json(data);

        } catch (error) {

            console.error(
                "OCTO STATUS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Unable to check payment status"
            });
        }
    }
);


/* =========================
   OCTO NOTIFICATION
========================= */

app.post(
    "/api/octo/notify",
    async (req, res) => {

        try {

            console.log(
                "OCTO NOTIFICATION:",
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );


            const transactionId =
                req.body?.shop_transaction_id;


            if (!transactionId) {

                return res.status(400).json({
                    error:
                        "shop_transaction_id is required"
                });
            }


            if (!OCTO_SECRET) {

                return res.status(500).json({
                    error:
                        "OCTO_SECRET is not configured"
                });
            }


            /*
             * OCTO statusini
             * server tomonda tekshiramiz.
             */

            const response =
                await fetch(
                    OCTO_API_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            octo_shop_id:
                                OCTO_SHOP_ID,

                            octo_secret:
                                OCTO_SECRET,

                            shop_transaction_id:
                                transactionId

                        })
                    }
                );


            const data =
                await response.json();


            console.log(
                "OCTO VERIFIED STATUS:",
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );


            return res.json({
                error: 0
            });

        } catch (error) {

            console.error(
                "OCTO NOTIFY ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Notification processing failed"
            });
        }
    }
);


/* =========================
   MAIN PAGE
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


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
