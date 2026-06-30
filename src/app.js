import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { getRealtimeDb, getFirebaseInitError } from "./config/firebase.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_, res) =>
  res.json({
    name: "Home Pisos Vinílicos API",
    status: "ok",
    docs: { health: "/health", orders: "/api/orders", webhooks: "/api/webhooks/mercadopago" },
  })
);
app.get("/api/ping", (_, res) => {
  console.log("[Ping] Backend activo - ping recibido");
  res.json({ active: true, message: "Backend activo" });
});
app.use("/api", routes);
app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/api/debug/firebase", async (_, res) => {
  const db = await getRealtimeDb();
  res.json({
    nodeEnv: process.env.NODE_ENV || "development",
    connected: !!db,
    initError: getFirebaseInitError(),
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    hasIndividualFirebaseCreds: !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ),
    hasGoogleCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    databaseUrl: process.env.FIREBASE_DATABASE_URL || "(default)",
  });
});

app.use(errorHandler);

export default app;
