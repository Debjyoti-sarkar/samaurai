// Simple test to check if server can start
import express from "express";

const app = express();
const PORT = 3001;

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "Server is running!" });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`Test it: http://localhost:${PORT}/ping`);
});
