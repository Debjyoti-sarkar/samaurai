// Minimal test server
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => res.json({ ok: true }));

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal server listening on ${PORT}`);
});