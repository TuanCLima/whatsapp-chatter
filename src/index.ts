import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import "dotenv/config";
import { whatsappHonoWebhook } from "./webhook";

const app = new Hono();
app.use("/public/*", serveStatic({ root: "./src" }));

app.post("/webhook", whatsappHonoWebhook);

// Only start a local server if running in Node.js (not Cloudflare)
if (typeof process !== "undefined") {
  if (process.env.NODE_ENV !== "production") {
    import("@hono/node-server").then(({ serve }) => {
      const port = process.env.PORT || 3000;
      serve({ fetch: app.fetch, port: Number(port) });
      console.log(`🚀 Server running at http://localhost:${port}`);
    });
  }
}

export default app;
