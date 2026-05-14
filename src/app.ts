import express from "express";
import path from "path";
import { loadDocuments } from "./services/documentRepository";
import v1Router from "./routes/v1";

const app = express();

// Load SOP documents into memory on startup
loadDocuments();

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1", v1Router);

export default app;
