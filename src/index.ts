import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import "dotenv/config";
import { whatsappHonoWebhook } from "./webhook";
import path from "path";

const app = new Hono();
app.use("/*", serveStatic({ root: path.resolve(__dirname, "../dist/*") }));

app.post("/webhook", whatsappHonoWebhook);

if (process.env.NODE_ENV !== "production") {
  console.log("Configured routes:");
  app.routes.forEach((route) => {
    console.log(`${route.method} ${route.path}`);
  });
}

// Start the server and bind to the correct port
import("@hono/node-server").then(({ serve }) => {
  const port = process.env.PORT || 3000; // Use the PORT environment variable or default to 3000
  serve({ fetch: app.fetch, port: Number(port) });
  console.log(`🚀 Server running at http://localhost:${port}`);
});

export default app;
