import { authorize, validateToken } from '../googleCalendar/googleAuth'

/**
 * Script to maintain Google Calendar token validity
 * Run this periodically (e.g., daily) to ensure tokens stay fresh
 */

async function maintainToken() {
  console.log('Checking token validity...')
  
  const isValid = await validateToken()
  
  if (!isValid) {
    console.log('Token is invalid or expired. Attempting to refresh...')
    
    try {
      await new Promise<void>((resolve, reject) => {
        authorize(async (auth) => {
          console.log('Token maintenance successful!')
          resolve()
        }).catch(reject)
      })
    } catch (error) {
      console.error('Token maintenance failed:', error)
      console.log('Manual reauthorization may be required.')
      process.exit(1)
    }
  } else {
    console.log('Token is valid and fresh.')
  }
}

// Run the maintenance
maintainToken().catch(console.error)
