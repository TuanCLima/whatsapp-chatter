import express from "express";
import "dotenv/config";
import { whatsappHonoWebhook } from "./webhook";
import path from "path";
import mcpRouter from "./server/mcpServer";

export const PORT = process.env.PORT ?? 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.resolve(__dirname, "../dist/public")));

app.use("/api/mcp", mcpRouter);

app.post("/webhook", whatsappHonoWebhook);

app.listen(PORT, () => {
  console.log(`🚀 Server running at port: ${PORT}`);
});

export default app;
