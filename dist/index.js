"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const serve_static_1 = require("@hono/node-server/serve-static");
require("dotenv/config");
const webhook_1 = require("./webhook");
const app = new hono_1.Hono();
app.use("/public/*", (0, serve_static_1.serveStatic)({ root: "./src" }));
app.post("/webhook", webhook_1.whatsappHonoWebhook);
// Only start a local server if running in Node.js (not Cloudflare)
if (typeof process !== "undefined") {
    if (process.env.NODE_ENV !== "production") {
        Promise.resolve().then(() => __importStar(require("@hono/node-server"))).then(({ serve }) => {
            const port = process.env.PORT || 3000;
            serve({ fetch: app.fetch, port: Number(port) });
            console.log(`🚀 Server running at http://localhost:${port}`);
        });
    }
}
exports.default = app;
