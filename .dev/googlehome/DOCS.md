# Google Home Token Hub Documentation

The **Google Home Token Hub** add-on handles authentication and token generation for both **[ha-googlehome](https://github.com/FaserF/ha-googlehome)** and **[BSkando/GoogleFindMy-HA](https://github.com/BSkando/GoogleFindMy-HA)**.

## Quick Start

1. Start the add-on and open the Ingress Web UI.
2. In the **Google Home** tab:
   - Follow the login guide or enter your Google credentials / App Password.
   - Home Assistant's `ha-googlehome` integration will auto-discover and connect automatically!
3. In the **Google Find My (Trackers)** tab:
   - Click **Generate ADM Token** to mint access tokens for Android Device Manager / Spot API.
   - Click **Retrieve E2EE Key (Google Unlock)** to decrypt real-time tracker locations.
   - Click **Deploy directly to Home Assistant** to export `secrets.json` directly into `custom_components/googlefindmy/Auth/secrets.json`.
