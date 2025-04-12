import fs from "fs";
import path from "path";
import readline from "readline";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const CREDENTIALS_PATH = path.join(__dirname, "..", "credentials.json");
const TOKEN_PATH = path.join(__dirname, "..", "token.json");

export async function authorize(callback: (auth: any) => Promise<void>) {
  const file = fs.readFileSync(CREDENTIALS_PATH, "utf-8");

  let credentials: any = {};
  try {
    credentials = JSON.parse(file);
  } catch {
    throw new Error("Error parsing credentials file");
  }

  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  if (fs.existsSync(TOKEN_PATH)) {
    const tokenText = fs.readFileSync(TOKEN_PATH, "utf-8");
    const token = JSON.parse(tokenText);
    oAuth2Client.setCredentials(token);

    if (token.expiry_date && token.expiry_date <= Date.now()) {
      console.log("Access token expired. Refreshing...");
      const newToken = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(newToken.credentials);

      // Save the new token to disk
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken.credentials));
      console.log("Token refreshed and saved to disk.");
    }

    return callback(oAuth2Client);
  } else {
    getAccessToken(oAuth2Client, callback);
  }
}

function getAccessToken(
  oAuth2Client: OAuth2Client,
  callback: (auth: any) => Promise<void>
) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  console.log("Authorize this app by visiting this URL:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err || !token)
        return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);

      // Store the token to disk for later program executions
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log("Token stored to", TOKEN_PATH);
      callback(oAuth2Client);
    });
  });
}

module.exports = { authorize };
