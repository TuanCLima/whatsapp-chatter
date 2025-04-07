"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const webhook_1 = require("./webhook");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
console.log("### PORT:", process.env.PORT);
const port = process.env.PORT || 3000;
app.use(express_1.default.urlencoded({ extended: true }));
// Middleware to parse JSON requests
app.use(express_1.default.json());
// Serve static files
app.use(express_1.default.static(path_1.default.resolve(__dirname, "../dist/public")));
// Define the webhook route
app.post("/webhook", webhook_1.whatsappHonoWebhook);
// Start the server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
exports.default = app;
