import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const distPublicPath = path.join(__dirname, "../../dist/public");

// Ensure the dist/public directory exists
fs.mkdirSync(distPublicPath, { recursive: true });

const N = Number(process.env.N);

if (isNaN(N) || N < 1) {
  console.error("Error: N environment variable must be set.");
  process.exit(1);
}

for (let i = 1; i <= N; i++) {
  const contact = process.env[`CONTACT_${i}`];
  if (!contact) {
    console.error(`Error: CONTACT_${i} environment variable must be set.`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(distPublicPath, `CONTACT_${i}.vcf`), contact);
}

console.log("✅ vCard files generated successfully in dist/public.");
