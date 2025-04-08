import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const distPublicPath = path.join(__dirname, "../../dist/public");

// Ensure the dist/public directory exists
fs.mkdirSync(distPublicPath, { recursive: true });

// Read vCard contents from environment variables
const contact1 = process.env.CONTACT_1;
const contact2 = process.env.CONTACT_2;
const contact3 = process.env.CONTACT_3;

if (!contact1 || !contact2 || !contact3) {
  console.error(
    "Error: CONTACT_1 and CONTACT_2 environment variables must be set."
  );
  process.exit(1);
}

// Write the vCard files
fs.writeFileSync(path.join(distPublicPath, "gabe_contact.vcf"), contact1);
fs.writeFileSync(path.join(distPublicPath, "rafa_contact.vcf"), contact2);
fs.writeFileSync(path.join(distPublicPath, "karina_contact.vcf"), contact3);

console.log("✅ vCard files generated successfully in dist/public.");
