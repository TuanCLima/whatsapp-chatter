import express from "express";
import "dotenv/config";
import { whatsappHonoWebhook } from "./webhook";
import path from "path";

const app = express();
console.log("### PORT:", process.env.PORT);
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
// Middleware to parse JSON requests
app.use(express.json());

// Serve static files
app.use(express.static(path.resolve(__dirname, "../dist/public")));

// Define the webhook route
app.post("/webhook", whatsappHonoWebhook);

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

export default app;
