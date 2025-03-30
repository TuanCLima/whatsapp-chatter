import Fastify from "fastify";
import "dotenv/config";
import { whatsappWebhook } from "./webhook";
import { sendWhatsAppMessage } from "./sendMessage";
import formBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import awsLambdaFastify from "@fastify/aws-lambda";

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

export const handler = awsLambdaFastify(app);
