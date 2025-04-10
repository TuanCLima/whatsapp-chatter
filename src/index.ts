import express from "express";
import "dotenv/config";
import { whatsappHonoWebhook } from "./webhook";
import path from "path";
import mcpRouter from "./server/mcpServer";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.resolve(__dirname, "../dist/public")));

app.use("/api/mcp", mcpRouter);

app.post("/webhook", whatsappHonoWebhook);

app.listen(port, () => {
  console.log(`🚀 Server running at port: ${port}`);
});

export default app;
