# Imapsync Add-on: Complete Documentation

Welcome to the definitive guide for the Home Assistant Imapsync Add-on. This tool is a powerful wrapper around the industry-standard `imapsync` utility, designed for heavy-duty mail migration, backup, and synchronization.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [OAuth2 Authentication (Modern Auth)](#oauth2-authentication-modern-auth)
3. [Global Configuration](#global-configuration)
4. [Job Configuration](#job-configuration)
5. [Multi-Account Sync Example](#multi-account-sync-example)
6. [Provider-Specific Guide (Critical)](#provider-specific-guide)
   - [Gmail](#gmail)
   - [Yahoo Mail](#yahoo-mail)
   - [Outlook / Office 365](#outlook--office-365)
   - [iCloud](#icloud)
   - [GMX / Web.de](#gmx--webde)
   - [Fastmail](#fastmail)
7. [Advanced CLI Flags](#advanced-cli-flags)
8. [Performance & Large Migrations](#performance--large-migrations)
9. [Troubleshooting & FAQ](#troubleshooting--faq)
10. [Security Best Practices](#security-best-practices)

---

## Core Concepts

Imapsync works by connecting to two IMAP servers (Source and Destination) and copying messages between them.

- **Incremental by design**: It tracks which messages have already been copied. Subsequent runs will only sync new or changed messages.
- **One-way sync**: By default, it copies from the **Source** to the **Destination**. It does **not** perform two-way synchronization.
- **Support for multiple accounts**: You can add many independent sync pairs (e.g., A -> B, C -> D).
- **Stateless**: The add-on itself doesn't store your mail; it merely facilitates the transfer.

---

## OAuth2 Authentication (Modern Auth)

This add-on supports OAuth2 for Google (Gmail/Advanced Protection) and Microsoft (Office 365/Outlook). This is the recommended method for these providers as it avoids "Less Secure App" issues.

---

## Global Configuration

Located in the main configuration tab of the add-on.

| Option          | Type    | Default | Description                                                            |
| :-------------- | :------ | :------ | :--------------------------------------------------------------------- |
| `sync_interval` | Integer | `3600`  | Seconds between sync cycles. Minimum: `90` (or `0` for run-once mode). |
| `log_level`     | String  | `info`  | Adjusts verbosity (`debug`, `info`, `warning`, etc.).                  |

> [!NOTE]
> If `sync_interval` is set to `0`, the add-on will execute all defined jobs once and then go into an idle state (run-once mode). You will need to restart the add-on to trigger another sync.

---

## Job Configuration

The `jobs` section is a list (array), meaning you can sync multiple accounts. **This allows you to sync Account A to Account B, and Account C to Account D independently in the same cycle.**

For each job, you must provide:

- `source_host` / `source_user` / `source_password`: The **source** account (where the mail currently is).
- `destination_host` / `destination_user` / `destination_password`: The **destination** account (where the mail should go).
- `delete_after_sync`: (Boolean, Default: `false`) If set to `true`, messages are deleted from the source after a successful transfer. **WARNING: Use with caution as this action is irreversible!**
- `additional_cli_args`: (Optional) Advanced flags for the `imapsync` CLI.

Example:

```yaml
jobs:
  - source_host: imap.source.com
    source_user: user@source.com
    source_password: 'secret123'
    destination_host: imap.dest.com
    destination_user: user@dest.com
    destination_password: 'secret456'
    delete_after_sync: false
```

---

## Multi-Account Sync Example

You can sync completely different accounts in the same add-on run:

```yaml
sync_interval: 3600
jobs:
  - source_host: imap.yahoo.com
    source_user: user1@yahoo.com
    source_password: 'password1'
    destination_host: imap.gmail.com
    destination_user: user1@gmail.com
    destination_password: 'password1'
  - source_host: imap.outlook.com
    source_user: user2@outlook.com
    source_password: 'password2'
    destination_host: imap.fastmail.com
    destination_user: user2@fastmail.com
    destination_password: 'password2'
```

---

## Provider-Specific Guide

Most issues arise from provider security settings. Follow these steps exactly.

### Gmail

- **IMAP Server:** `imap.gmail.com`
- **Enable IMAP:** Settings -> Forwarding and POP/IMAP -> **Enable IMAP**.
- **Password:** You **MUST** use a Google App Password.
  1. Go to Google Account -> Security.
  2. Enable **2-Step Verification**.
  3. Search for **App Passwords**.
  4. Generate one for "Other (Custom Name)" -> "Home Assistant".
- **Limitations:** Google has strict daily bandwidth limits (around 2.5GB for downloading and 500MB for uploading).

#### 🛡️ Google Advanced Protection Program

> [!CAUTION]
> If your Google account is enrolled in the **Advanced Protection Program**, you **cannot** use this add-on with a private OAuth2 project or an App Password.
>
> Google's policy for APP explicitly blocks unverified 3rd-party applications from accessing sensitive data like your Gmail via IMAP. This results in the `400: policy_enforced` error when using private Clients.
>
> **Personal accounts with APP are currently incompatible with imapsync.** Only Workspace accounts where an admin can whitelist the Client ID remain supported.

### Yahoo Mail

- **IMAP Server:** `imap.mail.yahoo.com`
- **Enable IMAP:** Usually enabled by default.
- **Password:** You **MUST** use a Yahoo App Password.
  1. Account Info -> Account Security.
  2. **Generate app password**.
- **Important:** Yahoo often flags "too many logins" if your sync interval is too short.

### Outlook / Office 365

- **IMAP Server:** `outlook.office365.com`
- **Modern Auth:** Microsoft is phasing out "Basic Auth".
- **App Password:** Required if 2FA is active. Generate it via your Microsoft Account security dashboard.
- **Throttling:** Exchange Online is aggressive at throttling during large migrations.

### iCloud

- **IMAP Server:** `imap.mail.me.com`
- **Password:** An **app-specific password** is mandatory. Your Apple ID password will fail.
- **Username:** Try just the name part (e.g., `johnappleseed`) or the full email if it fails.

### GMX / Web.de

- **IMAP Server:** `imap.gmx.com` or `imap.web.de`.
- **Activation:** **IMAP IS DISABLED BY DEFAULT.**
  - Go to Settings -> POP3/IMAP -> Enable "Send and receive emails via external program".
- **TLS:** Only supports TLS 1.2 or higher.

### Fastmail

- **IMAP Server:** `imap.fastmail.com`
- **Password:** App password required (Settings -> Privacy & Security -> App Passwords).

---

## Advanced CLI Flags

Most common `imapsync` flags are now available directly in the **Configuration UI**. Use the `additional_cli_args` section for everything else.

### UI Settings Guide

- **Included Folders**: Use regular expressions to sync only specific folders.
  - _Example (Inbox Only)_: `^INBOX$`
  - _Example (Inbox and Sent)_: `^INBOX$|^Sent`
- **Excluded Folders**: Skip specific folders easily.
  - _Example (Archive)_: `^Archive$`
- **Max Age / Size**: Efficiently skip old or massive emails to speed up the sync.
- **Dry Run**: Always recommended when testing new filters to see results without moving data.

### 🛠️ Additional CLI Flags

| Flag          | Description                                            | Example                 |
| :------------ | :----------------------------------------------------- | :---------------------- |
| `--truncmess` | Truncate messages if they exceed provider size limits. | `- "--truncmess"`       |
| `--regexflag` | Fine-tune how flags are treated.                       | `- "--regexflag '...'"` |

---

## Performance & Large Migrations

For mailboxes exceeding 10GB or 100,000 messages:

1. **The "Pre-Sync" Strategy**:
   - Run a sync with `--maxage 365` first to get the most recent (and relevant) mail moved quickly.
   - Then run a full sync without the age limit.
2. **Handle Attachments**: Use `--maxsize` to skip massive files if your destination provider has small attachment limits.
3. **Throttling Awareness**: If you get "Connection Reset" or "Socket Closed," your provider is throttling you. Increase the `sync_interval` to be less aggressive.

---

## Troubleshooting & FAQ

### "Authentication Failed"

- Double-check the **App Password**. 99% of failures are due to using the primary password.
- Verify IMAP is **enabled** in the provider's web interface.

### "Connection Timeout"

- Check that the host is reachable.
- Verify your Home Assistant instance isn't behind a firewall blocking port 993 (IMAP SSL).

### "Out of Memory"

- Imapsync calculates message maps in RAM. For extremely large folders (1M+ emails), the add-on might hit memory limits. Use `--include` to sync specific folders at a time if this happens.

### "Duplicate Emails"

- This can happen if the UID mapping gets corrupted on one side. Imapsync is usually good at preventing this, but if it occurs, try removing `--usecache` temporarily in CLI args.

---

## Security Best Practices

1. **Minimal Permissions**: When creating App Passwords, select the "Mail" scope only if available.
2. **Secrets Storage**: Always use the Home Assistant `!secret` tag in your YAML configuration if you are editing via the file editor, or rely on the UI which handles masked password fields.
3. **Regular Audits**: Rotate your App Passwords every few months.
4. **Logs**: Don't share your add-on logs publicly as they might contain folder names and email addresses.

---

_For issues with the Imapsync software itself, visit the [official imapsync documentation](https://imapsync.lamiral.info/FAQ.d/)._
