import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { google } from 'googleapis'
import { gaxios, OAuth2Client } from 'google-auth-library'

const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json')
const TOKEN_PATH = path.join(__dirname, '..', 'token.json')

export async function authorize(callback: (auth: any) => Promise<void>) {
  const file = fs.readFileSync(CREDENTIALS_PATH, 'utf-8')

  let credentials: any = {}
  try {
    credentials = JSON.parse(file)
  } catch {
    throw new Error('Error parsing credentials file')
  }

  const { client_secret, client_id, redirect_uris } = credentials.web
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  )

  // Check if we have previously stored a token.
  if (fs.existsSync(TOKEN_PATH)) {
    const tokenText = fs.readFileSync(TOKEN_PATH, 'utf-8')
    const token = JSON.parse(tokenText)
    oAuth2Client.setCredentials(token)

    // Validate that we have a refresh token
    if (!token.refresh_token) {
      console.log('No refresh token found. Requesting new authorization...')
      fs.unlinkSync(TOKEN_PATH)
      return getAccessToken(oAuth2Client, callback)
    }

    // Check if token is close to expiry (refresh if less than 5 minutes remaining)
    if (token.expiry_date && token.expiry_date <= Date.now() + (5 * 60 * 1000)) {
      console.log('Access token expired or expiring soon. Refreshing...')
      try {
        const newToken = await oAuth2Client.refreshAccessToken()
        oAuth2Client.setCredentials(newToken.credentials)

        // Save the new token to disk
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken.credentials))
        console.log('Token refreshed and saved to disk.')
      } catch (error) {
        console.error('Error refreshing token:', error)
        if (error instanceof gaxios.GaxiosError) {
          const { message, status } = error

          if (message === 'invalid_grant' || status === 400) {
            // Delete the token file and call authorize again
            console.log('Refresh token expired or invalid. Requesting new authorization...')
            fs.unlinkSync(TOKEN_PATH)
            return authorize(callback)
          }
        }
        
        // For other errors, still try to proceed with existing token
        console.log('Failed to refresh token, but continuing with existing credentials...')
      }
    }

    return callback(oAuth2Client)
  } else {
    getAccessToken(oAuth2Client, callback)
  }
}

// Utility function to check token validity
export async function validateToken(): Promise<boolean> {
  if (!fs.existsSync(TOKEN_PATH)) {
    return false
  }

  try {
    const tokenText = fs.readFileSync(TOKEN_PATH, 'utf-8')
    const token = JSON.parse(tokenText)

    // Check if we have a refresh token
    if (!token.refresh_token) {
      return false
    }

    // Check if token is not expired (with 10 minute buffer)
    if (token.expiry_date && token.expiry_date <= Date.now() + (10 * 60 * 1000)) {
      return false
    }

    return true
  } catch {
    return false
  }
}

function getAccessToken(
  oAuth2Client: OAuth2Client,
  callback: (auth: any) => Promise<void>,
) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent screen to ensure refresh token
    scope: ['https://www.googleapis.com/auth/calendar'], // Updated scope
  })
  console.log('Authorize this app by visiting this URL:', authUrl)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.question('Enter the code from that page here: ', (code) => {
    rl.close()
    oAuth2Client.getToken(code, (err, token) => {
      if (err || !token)
        return console.error('Error retrieving access token', err)
      oAuth2Client.setCredentials(token)

      // Store the token to disk for later program executions
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
      console.log('Token stored to', TOKEN_PATH)
      callback(oAuth2Client)
    })
  })
}

module.exports = { authorize, validateToken }
