import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

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

app.use(errorHandler);

export default app;
