import express from "express";
import path from "path";
import { loadDocuments } from "./services/documentRepository";
import v1Router from "./routes/v1";
import v2Router from "./routes/v2";
import v3Router from "./routes/v3";

const app = express();

// Load SOP documents into memory on startup
loadDocuments();

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1", v1Router);
app.use("/v2", v2Router);
app.use("/v3", v3Router);

export default app;
