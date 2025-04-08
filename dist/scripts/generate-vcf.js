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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
require("dotenv/config");
const distPublicPath = path.join(__dirname, "../../dist/public");
// Ensure the dist/public directory exists
fs.mkdirSync(distPublicPath, { recursive: true });
// Read vCard contents from environment variables
const contact1 = process.env.CONTACT_1;
const contact2 = process.env.CONTACT_2;
const contact3 = process.env.CONTACT_3;
if (!contact1 || !contact2 || !contact3) {
    console.error("Error: CONTACT_1 and CONTACT_2 environment variables must be set.");
    process.exit(1);
}
// Write the vCard files
fs.writeFileSync(path.join(distPublicPath, "gabe_contact.vcf"), contact1);
fs.writeFileSync(path.join(distPublicPath, "rafa_contact.vcf"), contact2);
fs.writeFileSync(path.join(distPublicPath, "karina_contact.vcf"), contact3);
console.log("✅ vCard files generated successfully in dist/public.");
