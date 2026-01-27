# Migration Guide: Official vs. Custom Vaultwarden Add-on

Since this custom add-on uses a different "slug" (`vaultwarden` instead of `bitwarden`), **Home Assistant treats it as a completely separate add-on with its own data storage.**

You cannot simply uninstall one and install the other and expect your data to be there. You must migrate your data manually.

## ⚠️ Important Warning

**ALWAYS BACKUP YOUR VAULT BEFORE DOING ANYTHING!**
If something goes wrong effectively, you could lose all your passwords.

## Method 1: The Safe Way (Recommended)

This method involves exporting your vault content to a JSON file and importing it into the new instance.

### Step 1: Export from Old Add-on
1. Open the Web UI of your CURRENT running Vaultwarden add-on.
2. Log in to your vault.
3. Go to **Tools** > **Export Vault**.
4. Choose **.json** format.
5. Enter your Master Password to confirm.
6. **Download the file and keep it safe.** This file contains all your passwords in plain text (unless you chose encrypted export, which is safer but harder to import if encryption keys differ).

### Step 2: Switch Add-ons
1. Stop the old add-on.
2. Install the new "Vaultwarden (Custom)" add-on.
3. Start the new add-on.
4. Create a new account (you can use the same email and master password as before).

### Step 3: Import to New Add-on
1. Log in to the new Vaultwarden Web UI.
2. Go to **Tools** > **Import Data**.
3. Select **Bitwarden (json)** as the format.
4. Select the file you downloaded in Step 1.
5. Click **Import**.

### Step 4: Verification
1. Verify all your passwords and items are present.
2. Once verified, delete the exported JSON file securely (it contains sensitive data!).

---

## Method 2: The Advanced Way (Preserves detailed history/attachments)

This method involves manually copying the database files. This requires SSH access to your Home Assistant instance.

**Prerequisite:** You need the "Advanced SSH & Web Terminal" add-on installed and configured with `protection_mode: false`.

1. **Stop BOTH add-ons.**
2. Open SSH Terminal.
3. Locate the data directories.
   - Official Add-on: `/addon_configs/a0d7b954_bitwarden` (or `/data` inside the container context, usually mapped to `/mnt/data/supervisor/addons/data/a0d7b954_bitwarden` on host).
   - Custom Add-on: `/addon_configs/local_vaultwarden` (slug depends on how it was installed, check `/mnt/data/supervisor/addons/data/` for the correct folder name).

   *Note: In Home Assistant OS, direct access to `/mnt/data` might be restricted. The easiest way is often to use the Backup feature.*

### Using HA Backups (Alternative Advanced)
1. Create a partial backup of the **Old Add-on**.
2. Download the backup `.tar` file to your computer.
3. Extract the `.tar`. Inside you will find a `.tar.gz` containing the data.
4. Extract the data. You should see `db.sqlite3`, `attachments/`, etc.
5. Now, you need to place these files into the data folder of the new add-on.
   - This effectively requires root access to the filesystem or a way to inject files into the new add-on's data volume.
   - **Recommendation:** Stick to Method 1 unless you absolutely need attachments/history and know how to use `docker cp` or manage HA volumes manually.

## Switching Back to Official

The process is identical, just reversed:
1. Export from Custom Add-on.
2. Install/Start Official Add-on.
3. Import to Official Add-on.
