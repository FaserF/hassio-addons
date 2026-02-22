# 🔐 OAuth2 Setup Guide

This guide explains how to obtain the necessary credentials to use OAuth2 with Gmail (including Advanced Protection) and Office 365.

## 🔴 Google (Gmail / Advanced Protection)

> [!CAUTION]
> **Advanced Protection Program (APP) Restriction**
> If your personal Google account is enrolled in the **Advanced Protection Program**, Google will block **any** private OAuth2 project (like the one created in this guide) from accessing your mail. You will see a `400: policy_enforced` error.
>
> **Personal accounts with APP enabled cannot use this add-on via OAuth2 or Password.** The only known workarounds are:
> 1. Use a Google Workspace account (where an admin can whitelist the Client ID).
> 2. Disable Advanced Protection (not recommended).
> 3. Use a different account that is not enrolled in APP.

## 📋 Requirement Matrix

| Field | Required for Password | Required for Google OAuth2 | Required for Microsoft OAuth2 |
| :--- | :---: | :---: | :---: |
| **Username** | ✅ | ✅ | ✅ |
| **Password** | ✅ | ❌ | ❌ |
| **Client ID** | ❌ | ✅ | ✅ |
| **Client Secret** | ❌ | ✅ | ✅ |
| **Refresh Token** | ❌ | ✅ | ✅ |
| **Tenant ID** | ❌ | ❌ | ⚠️ (Optional/Common) |

> [!NOTE]
> The **Refresh Token** is strictly required for both Google and Microsoft. It allows the add-on to keep syncing in the background after your initial login expires (usually after 1 hour).

### 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** -> **New Project**.
3. Name it "Home Assistant Imapsync" and click **Create**.

### 2. Configure OAuth Consent Screen
1. Go to **APIs & Services** -> **OAuth consent screen**.
2. Select **External** and click **Create**.
3. Fill in the "App information" (App name, User support email).
4. Add your email to "Developer contact information".
5. Click **Save and Continue**.
6. **Scopes**: Click **Add or Remove Scopes**.
7. Manually add: `https://mail.google.com/`
8. Click **Save and Continue**.
9. **Test Users**: Add your own email address.

### 3. Create Credentials
1. Go to **APIs & Services** -> **Credentials**.
2. Click **Create Credentials** -> **OAuth client ID**.
3. Select **Web application**.
4. **Authorized redirect URIs**: Add `https://developers.google.com/oauthplayground`
5. Click **Create** and save your **Client ID** and **Client Secret**.

### 4. Obtain Refresh Token
1. Go to the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Click the gear icon (top right) and check **Use your own OAuth credentials**.
3. Enter your **Client ID** and **Client Secret**.
4. In **Step 1**, enter `https://mail.google.com/` in the input field and click **Authorize APIs**.
5. Log in and allow permissions.
6. In **Step 2**, click **Exchange authorization code for tokens**.
7. Copy the **Refresh token**.

---

## 🔵 Microsoft (Office 365 / Outlook)

### 1. Register Application
1. Go to the [Azure Portal](https://portal.azure.com/) -> **Microsoft Entra ID** (formerly Azure AD).
2. Go to **App registrations** -> **New registration**.
3. Name: "Home Assistant Imapsync".
4. Supported account types: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts".
5. Redirect URI: Select **Web** and enter `https://oauth.pstmn.io/v1/callback`.
6. Click **Register**.

### 2. Configure Permissions
1. Go to **API permissions** -> **Add a permission**.
2. Select **Microsoft Graph** -> **Delegated permissions**.
3. Search and add: `IMAP.AccessAsUser.All`, `offline_access`.
4. Click **Add permissions**.

### 3. Create Secret
1. Go to **Certificates & secrets** -> **New client secret**.
2. Name it "Addon secret" and click **Add**.
3. Copy the **Value** (this is your Client Secret).

### 4. Obtain Refresh Token
The easiest way is using a tool like [Postman](https://www.postman.com/) or a simple script.
1. **Auth URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
2. **Access Token URL**: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
3. **Scope**: `https://outlook.office.com/IMAP.AccessAsUser.All offline_access`
4. **Grant Type**: Authorization Code.

---

## ⚙️ Configuration in Add-on
Add the harvested values to your sync job:

```yaml
jobs:
  - source_host: imap.gmail.com
    source_user: your-email@gmail.com
    source_auth_type: oauth2
    source_oauth2_client_id: "your-client-id"
    source_oauth2_client_secret: "your-client-secret"
    source_oauth2_refresh_token: "your-refresh-token"
```
