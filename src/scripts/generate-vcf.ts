import * as fs from 'fs'
import * as path from 'path'
import 'dotenv/config'

const distPublicPath = path.join(__dirname, '../../dist/public')

// Ensure the dist/public directory exists
fs.mkdirSync(distPublicPath, { recursive: true })

const N = Number(process.env.N)

if (isNaN(N) || N < 1) {
  console.error('Error: N environment variable must be set.')
  process.exit(1)
}

for (let i = 1; i <= N; i++) {
  const contact = process.env[`CONTACT_${i}`]
  if (!contact) {
    console.error(`Error: CONTACT_${i} environment variable must be set.`)
    process.exit(1)
  }

  fs.writeFileSync(path.join(distPublicPath, `CONTACT_${i}.vcf`), contact)
}

console.log('✅ vCard files generated successfully in dist/public.')

// Copy static assets to dist/public
const publicSourcePath = path.join(__dirname, '../../public')
if (fs.existsSync(publicSourcePath)) {
  const files = fs.readdirSync(publicSourcePath)
  for (const file of files) {
    const sourcePath = path.join(publicSourcePath, file)
    const destPath = path.join(distPublicPath, file)
    fs.copyFileSync(sourcePath, destPath)
    console.log(`✅ Copied ${file} to dist/public`)
  }
}
