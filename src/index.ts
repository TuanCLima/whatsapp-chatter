// src/index.ts
import Fastify from "fastify";
import "dotenv/config";
import { whatsappWebhook } from "./webhook";
import { sendWhatsAppMessage } from "./sendMessage";
import formBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";

// Create Fastify app
const app = Fastify();

// Register plugins
app.register(formBody);
app.register(whatsappWebhook);
app.register(sendWhatsAppMessage);
app.register(fastifyStatic, {
  root: `${__dirname}/public`, // Adjust the path to your static files
  prefix: "/", // Optional: prefix for the static files
});

// For local development only
if (process.env.IS_OFFLINE) {
  const PORT = process.env.PORT || 3000;
  app.listen({ port: Number(PORT), host: "0.0.0.0" }, (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// Export for Cloudflare Workers/Pages
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Convert the Cloudflare request to a Node.js-like request
    const url = new URL(request.url);

    // Handle the request with Fastify
    const response = await app.inject({
      method: request.method,
      url: url.pathname + url.search,
      headers: Object.fromEntries(request.headers),
      payload: request.body ? await request.text() : undefined,
    });

    // Convert Fastify's response to a Cloudflare Response
    return new Response(response.body, {
      status: response.statusCode,
      headers: response.headers as HeadersInit,
    });
  },
};
