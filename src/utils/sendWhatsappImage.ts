import twilio from 'twilio'

const accountSid = 'YOUR_TWILIO_ACCOUNT_SID'
const authToken = 'YOUR_TWILIO_AUTH_TOKEN'
const client = twilio(accountSid, authToken)

export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
) {
  return client.messages.create({
    from: 'whatsapp:+YOUR_TWILIO_WHATSAPP_NUMBER',
    to: `whatsapp:${to}`,
    body: caption || '',
    mediaUrl: [imageUrl],
  })
}
