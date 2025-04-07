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
const port = process.env.PORT ?? 3000;
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.resolve(__dirname, "../dist/public")));
app.post("/webhook", webhook_1.whatsappHonoWebhook);
app.listen(port, () => {
    console.log(`🚀 Server running at port: ${port}`);
});
exports.default = app;
