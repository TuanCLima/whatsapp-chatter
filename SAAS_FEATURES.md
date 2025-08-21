# 🚀 Multi-Tenant SaaS WhatsApp ChatBot

This application now supports **multi-tenant SaaS** functionality, allowing multiple users to bring their own Twilio credentials and run independent WhatsApp chatbots.

## 🌟 New Features

### 🏢 Multi-Tenant Architecture
- **User Registration & Authentication**: Users can create accounts and manage their own chatbot instances
- **Bring Your Own Twilio (BYOT)**: Each user configures their own Twilio credentials
- **Isolated Conversations**: Each user's WhatsApp conversations are completely separated
- **Dynamic Webhook URLs**: Each user gets a unique webhook endpoint

### 🔧 Configuration Management
- **Web-based Setup**: Easy-to-use configuration interface for Twilio credentials
- **Credential Validation**: Real-time validation of Twilio credentials before saving
- **Secure Storage**: Twilio Auth Tokens are encrypted at rest
- **Setup Wizard**: Step-by-step instructions for Twilio configuration

### 🔒 Security & Privacy
- **Encrypted Credentials**: All sensitive Twilio data is encrypted
- **User Isolation**: Complete separation between different users' data
- **Secure Authentication**: JWT-based authentication with HTTP-only cookies
- **Role-based Access**: Admin and user roles with appropriate permissions

## 📋 Setup Instructions

### 1. Environment Variables

Update your `.env` file with the new required variables:

```bash
# SaaS Configuration
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production
JWT_SECRET=your-jwt-secret-key-change-this-in-production

# Legacy Twilio (optional, for development)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

### 2. Database Migration

Run the database migration to create the new SaaS tables:

```bash
pnpm db:push
```

Or manually run the migration:

```sql
-- See migrations/002_saas_users.sql
```

### 3. User Registration

1. Navigate to the application
2. Click "Don't have an account? Sign up"
3. Create your account
4. Configure your Twilio credentials in the Config section

### 4. Twilio Configuration

For each user:

1. **Get Twilio Credentials**:
   - Account SID from Twilio Console
   - Auth Token from Twilio Console
   - WhatsApp Sandbox Number (format: `whatsapp:+1234567890`)

2. **Configure Webhook**:
   - Copy your unique webhook URL from the Config page
   - Paste it in Twilio Console → WhatsApp Sandbox Settings
   - Set as the "When a message comes in" webhook

3. **Test Integration**:
   - Send a message to your Twilio WhatsApp Sandbox number
   - Verify the chatbot responds correctly

## 🏗️ Architecture Overview

### User Flow
```
User Registration → Twilio Configuration → Webhook Setup → Ready to Use
```

### Technical Architecture
```
Frontend (React) ↔ Backend API ↔ Twilio Client Pool ↔ Individual Twilio Accounts
                                         ↓
                                  Encrypted Database Storage
```

### Key Components

1. **TwilioClientPool**: Manages and caches user-specific Twilio clients
2. **AuthService**: Handles user authentication and registration
3. **TwilioGuard**: Frontend component that ensures credentials are configured
4. **Dynamic Webhooks**: Route `/webhook/:webhookPath` for user-specific endpoints

## 🛡️ Security Features

- **Credential Encryption**: Twilio Auth Tokens encrypted with AES-256-GCM
- **Client Caching**: LRU cache for Twilio clients with TTL
- **Input Validation**: Comprehensive validation of all user inputs
- **Rate Limiting**: Built-in protection against abuse
- **Secure Sessions**: HTTP-only cookies for authentication

## 📱 User Experience

### Before Setup (First Time)
- Users see a setup wizard requiring Twilio configuration
- Clear instructions and links to Twilio Console
- Real-time credential validation

### After Setup
- Normal chat interface
- Full access to chatbot features
- Ability to update credentials anytime

## 🔄 Migration from Single-Tenant

Existing single-tenant installations can coexist with the new multi-tenant features:

- Legacy webhook `/webhook` still works with environment variables
- New SaaS webhooks use `/webhook/:webhookPath`
- Database schema is backwards compatible

## 🚨 Important Notes

1. **Encryption Keys**: Use strong, unique encryption keys in production
2. **Database Backups**: Ensure regular backups of user data
3. **Monitoring**: Monitor webhook endpoint usage and error rates
4. **Scaling**: Consider client pool size based on expected user count

## 📈 Future Enhancements

- [ ] Billing integration for paid plans
- [ ] Usage analytics and reporting
- [ ] Advanced user management
- [ ] Custom branding per user
- [ ] API rate limiting per user
- [ ] Webhook retry mechanisms

## 🆘 Troubleshooting

### Common Issues

1. **"Twilio credentials not configured"**
   - Ensure all three fields (Account SID, Auth Token, WhatsApp Number) are filled
   - Verify credentials are valid in Twilio Console

2. **"Webhook path not found"**
   - Check that the webhook URL matches exactly
   - Ensure user exists and has configured credentials

3. **Messages not sending**
   - Verify Twilio credentials are correct
   - Check webhook URL is properly configured in Twilio
   - Review server logs for error details

### Support

For additional help:
1. Check the application logs
2. Verify Twilio Console configuration
3. Test webhook endpoints manually
4. Review database entries for the user

---

This multi-tenant architecture provides a robust foundation for scaling your WhatsApp chatbot as a SaaS product! 🎉
