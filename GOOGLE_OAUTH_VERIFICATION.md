# Google OAuth App Verification Guide

## Overview

When your app shows as "not verified by Google" during OAuth consent, it's because your app hasn't gone through Google's verification process. This guide explains your options to fix this issue.

## Three Solutions

### 1. Use Test Users (Quickest - For Development) ⚡

**Best for:** Development phase or apps with limited users (up to 100)

**Steps:**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Scroll down to **Test users** section
4. Click **Add Users**
5. Add email addresses of users who should access the app
6. Save changes

**Benefits:**
- ✅ Immediate solution
- ✅ No verification needed
- ✅ Test users won't see the "unverified app" warning

**Limitations:**
- ⚠️ Maximum of 100 test users
- ⚠️ Only works for the specific email addresses you add

---

### 2. Submit for Full OAuth Verification (For Production) 🚀

**Best for:** Production apps or apps with many users

**When Required:**
- Using **sensitive scopes** (like Google Calendar API)
- Using **restricted scopes**
- Want to remove the warning for all users

**Prerequisites:**
- ✓ Verified domain
- ✓ Privacy policy URL (publicly accessible)
- ✓ Terms of service URL (publicly accessible)
- ✓ App homepage URL
- ✓ Authorized domains configured
- ✓ Video demonstration of your OAuth flow
- ✓ Written justification for each scope requested

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Complete all required fields:
   - App name
   - User support email
   - App logo (optional but recommended)
   - App domain
   - Authorized domains
   - Privacy policy link
   - Terms of service link
4. Click **Publish App** button
5. Click **Prepare for verification**
6. Complete the verification questionnaire
7. Submit required documents:
   - Video showing OAuth consent flow
   - Scope justifications
   - Domain verification proof
8. Submit for review

**Timeline:**
- ⏱️ Review typically takes **4-6 weeks**
- 📧 You'll receive email updates on the status

**Annual Requirements:**
- Apps with restricted scopes need **annual re-verification**

---

### 3. Use Internal User Type (For Google Workspace Only) 🏢

**Best for:** Apps used only within a Google Workspace organization

**Requirements:**
- Must have a Google Workspace organization
- App only accessed by users in that organization

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Select **Internal** as the User Type
4. Complete the consent screen configuration
5. Save changes

**Benefits:**
- ✅ No verification needed
- ✅ No user warnings
- ✅ Immediate solution

**Limitations:**
- ⚠️ Only works for Google Workspace organizations
- ⚠️ External users cannot use the app

---

## Recommended Approach for Your Project

Since you're using the **Google Calendar API** (which requires sensitive scopes):

### Phase 1: Development (Current)
✅ **Add test users** to continue development without warnings
- Add the main salon email: `ctt.hermanas@gmail.com`
- Add any other team member emails who need access
- This allows immediate testing without interruption

### Phase 2: Pre-Production
📝 **Prepare verification materials:**
1. Create a **Privacy Policy** page explaining:
   - What data you collect (calendar events)
   - How you use it (appointment scheduling)
   - How you protect it
   - User rights (access, deletion, etc.)

2. Create a **Terms of Service** page explaining:
   - How the service works
   - User responsibilities
   - Limitations of liability

3. Set up a **domain** for your app (if not already done)

4. Record a **demo video** showing:
   - User clicking login
   - OAuth consent screen appearing
   - User granting permissions
   - App functionality after authentication

### Phase 3: Production
🚀 **Submit for full verification** before launching to all customers

---

## Scope Information

Your app appears to use these scopes for Google Calendar:
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/calendar.events` - Calendar events access

These are **sensitive scopes** and require verification for production use.

---

## Additional Resources

- [OAuth App Verification Help Center](https://support.google.com/cloud/answer/13463073)
- [Submitting Your App for Verification](https://support.google.com/cloud/answer/13461325)
- [Verification Requirements](https://support.google.com/cloud/answer/13464321)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
- [When Verification is Not Needed](https://support.google.com/cloud/answer/13464323)

---

## Quick Start: Add Test Users Now

To immediately fix the warning for your development work:

```bash
# 1. Visit Google Cloud Console
# https://console.cloud.google.com/

# 2. Select your project: "chat-calendar-456517"

# 3. Go to: APIs & Services > OAuth consent screen

# 4. Scroll to "Test users" section

# 5. Add these emails:
#    - ctt.hermanas@gmail.com
#    - [any other team members]

# 6. Save and test - the warning should disappear for those users!
```

---

## Notes

- **Do not share** your production credentials in test mode
- Test users can use the app indefinitely during development
- Once you publish the app without verification, the 100-user test limit still applies
- Verification is **required** before removing the test user restriction for sensitive/restricted scopes

---

**Last Updated:** October 6, 2025
