import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

async function loadPromptToEnv() {
  try {
    // Define file paths
    const rootDir = path.resolve(__dirname, "../..");
    const promptFilePath = path.join(rootDir, "PROMPT.txt");
    const envFilePath = path.join(rootDir, ".env");

    // Read the contents of PROMPT.txt
    const promptContent = await fs.promises.readFile(promptFilePath, "utf-8");

    // Replace new line characters with a space
    const formattedPrompt = promptContent.split("\n").join(" ");

    // Load existing .env variables
    dotenv.config({ path: envFilePath });

    // Append or update the new environment variable
    const envVarName = "MYPROMPT";
    const envFileContent = fs.existsSync(envFilePath)
      ? await fs.promises.readFile(envFilePath, "utf-8")
      : "";
    const updatedEnvContent = envFileContent
      .split("\n")
      .filter((line) => !line.startsWith(`${envVarName}=`))
      .concat(`${envVarName}=${formattedPrompt}`)
      .join("\n");

    console.log(updatedEnvContent);

    // Write the updated .env file
    // await fs.promises.writeFile(envFilePath, updatedEnvContent, "utf-8");

    console.log(`Environment variable ${envVarName} has been updated.`);
  } catch (error) {
    console.error("Error loading prompt to .env:", error);
  }
}

// Run the function if executed as a script
if (require.main === module) {
  loadPromptToEnv();
}
