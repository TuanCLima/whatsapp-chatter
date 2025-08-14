import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { gaxios, type OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json')
const TOKEN_PATH = path.join(__dirname, '..', 'token.json')

export async function authorize(callback: (auth: any) => Promise<void>) {
  // Try environment variable first, then file
  let file: string
  if (process.env.GOOGLE_CREDENTIALS) {
    // Support base64 encoded credentials for security
    try {
      file = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString(
        'utf-8',
      )
    } catch {
      // If not base64, treat as direct JSON string
      file = process.env.GOOGLE_CREDENTIALS
    }
  } else {
    // Fallback to file system, with better error handling
    try {
      file = fs.readFileSync(CREDENTIALS_PATH, 'utf-8')
    } catch (error) {
      throw new Error(
        `Cannot read credentials file at ${CREDENTIALS_PATH}. Consider setting GOOGLE_CREDENTIALS environment variable. Error: ${error}`,
      )
    }
  }

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
    process.env.NODE_ENV === 'production' ? redirect_uris[1] : redirect_uris[0],
  )

  // Check if we have previously stored a token.
  let token: any = null

  // Try environment variable first for token
  if (process.env.GOOGLE_TOKEN) {
    try {
      const tokenStr = process.env.GOOGLE_TOKEN.startsWith('{')
        ? process.env.GOOGLE_TOKEN
        : Buffer.from(process.env.GOOGLE_TOKEN, 'base64').toString('utf-8')
      token = JSON.parse(tokenStr)
    } catch (error) {
      console.warn('Failed to parse GOOGLE_TOKEN environment variable:', error)
    }
  } else if (fs.existsSync(TOKEN_PATH)) {
    try {
      const tokenText = fs.readFileSync(TOKEN_PATH, 'utf-8')
      token = JSON.parse(tokenText)
    } catch (error) {
      console.warn('Failed to read token file:', error)
    }
  }

  if (token) {
    oAuth2Client.setCredentials(token)

    // Validate that we have a refresh token
    if (!token.refresh_token) {
      console.log('No refresh token found. Requesting new authorization...')
      // Only try to delete file if it exists and we're not using env token
      if (!process.env.GOOGLE_TOKEN && fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH)
      }
      return getAccessToken(oAuth2Client, callback)
    }

    // Check if token is close to expiry (refresh if less than 5 minutes remaining)
    if (token.expiry_date && token.expiry_date <= Date.now() + 5 * 60 * 1000) {
      console.log('Access token expired or expiring soon. Refreshing...')
      try {
        const newToken = await oAuth2Client.refreshAccessToken()
        oAuth2Client.setCredentials(newToken.credentials)

        // Save the new token to disk if possible (may fail in read-only environments)
        try {
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken.credentials))
          console.log('Token refreshed and saved to disk.')
        } catch {
          console.warn('Token refreshed but could not save to disk.')
        }
      } catch (error) {
        console.error('Error refreshing token:', error)
        if (error instanceof gaxios.GaxiosError) {
          const { message, status } = error

          if (message === 'invalid_grant' || status === 400) {
            // Delete the token file and call authorize again
            console.log(
              'Refresh token expired or invalid. Requesting new authorization...',
            )
            if (!process.env.GOOGLE_TOKEN && fs.existsSync(TOKEN_PATH)) {
              fs.unlinkSync(TOKEN_PATH)
            }
            return authorize(callback)
          }
        }

        // For other errors, still try to proceed with existing token
        console.log(
          'Failed to refresh token, but continuing with existing credentials...',
        )
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
    if (token.expiry_date && token.expiry_date <= Date.now() + 10 * 60 * 1000) {
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

      // Store the token to disk for later program executions (if possible)
      try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
        console.log('Token stored to', TOKEN_PATH)
      } catch {
        console.warn(
          'Token obtained but could not save to disk. Consider setting GOOGLE_TOKEN environment variable.',
        )
        console.log('Token (for GOOGLE_TOKEN):', JSON.stringify(token))
      }
      callback(oAuth2Client)
    })
  })
}

module.exports = { authorize, validateToken }
