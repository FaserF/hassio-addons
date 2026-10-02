"""Google Find My Device (Spot & Nova API) authentication & key helper.

Provides:
- ADM (Android Device Manager) OAuth token generation via gpsoauth.
- Spot/Nova API access token generation.
- Security domain unlock request URL generation for End-to-End Encryption (E2EE) Shared Key.
- Secrets bundle management and automatic export to Home Assistant's
  /config/custom_components/googlefindmy/Auth/secrets.json
"""

import binascii
import json
import logging
import os
import uuid
from typing import Any, Dict, Optional

_LOGGER = logging.getLogger("googlehome-addon.findmy")

ADM_CLIENT_SIG = "38918a453d07199354f8b19af05ec6562ced5788"
ADM_APP_ID = "com.google.android.apps.adm"
ADM_SERVICE = "oauth2:https://www.googleapis.com/auth/android_device_manager"


def get_security_domain_request_url() -> str:
    """Generate the Google Accounts security domain unlock request URL for E2EE keys.

    Mirrors GoogleFindMyTools KeyBackup/shared_key_request.py:
    Encodes EncryptionUnlockRequestExtras(operation=1, securityDomain.name='finder_hw')
    into base64.
    """
    # Binary protobuf manual encoding for EncryptionUnlockRequestExtras:
    # Field 1 (operation, varint): 0x08, 0x01
    # Field 2 (securityDomain, length-delimited):
    #   Subfield 1 (name = "finder_hw"): 0x0a, 0x09, b"finder_hw"
    #   Subfield 2 (unknown = 0): 0x10, 0x00
    # Field 3 (sessionId, string): 0x1a, len, uuid
    session_id = str(uuid.uuid4())
    session_id_bytes = session_id.encode("utf-8")

    domain_sub = b"\x0a\x09finder_hw\x10\x00"
    domain_field = b"\x12" + bytes([len(domain_sub)]) + domain_sub
    session_field = b"\x1a" + bytes([len(session_id_bytes)]) + session_id_bytes

    payload = b"\x08\x01" + domain_field + session_field
    b64_payload = binascii.b2a_base64(payload).decode("utf-8").strip()

    return f"https://accounts.google.com/encryption/unlock/android?kdi={b64_payload}"


def parse_vault_shared_keys(vault_keys_raw: str) -> Optional[str]:
    """Parse vaultKeys JSON returned by the JavaScript interface to extract the hex shared_key.

    Mirrors KeyBackup.response_parser.get_fmdn_shared_key.
    """
    try:
        data = json.loads(vault_keys_raw) if isinstance(vault_keys_raw, str) else vault_keys_raw
        finder_hw = data.get("finder_hw")
        if isinstance(finder_hw, list) and finder_hw:
            first_item = finder_hw[0]
            key_dict = first_item.get("key", {})
            if isinstance(key_dict, dict):
                # { "0": 12, "1": 34, ... } -> bytes
                byte_arr = bytearray(key_dict[str(i)] for i in range(len(key_dict)))
                return byte_arr.hex()
            elif isinstance(key_dict, (bytes, bytearray)):
                return bytes(key_dict).hex()
            elif isinstance(key_dict, str):
                return key_dict
    except Exception as err:
        _LOGGER.error("Failed to parse vault keys: %s", err)
    return None


def generate_adm_token(email: str, master_token: str, android_id: str = "android-701ab861a7be") -> Dict[str, Any]:
    """Use gpsoauth to mint an ADM token for Google Find My Device."""
    try:
        import gpsoauth

        res = gpsoauth.perform_oauth(
            email=email,
            master_token=master_token,
            android_id=android_id,
            service=ADM_SERVICE,
            app=ADM_APP_ID,
            client_sig=ADM_CLIENT_SIG,
        )
        if "Auth" in res:
            return {"success": True, "token": res["Auth"], "expiry": res.get("Expiry")}
        else:
            return {"success": False, "error": res.get("Error", "Unknown OAuth error")}
    except Exception as err:
        _LOGGER.exception("ADM token generation failed: %s", err)
        return {"success": False, "error": "ADM token generation failed"}


def deploy_secrets_to_homeassistant(secrets_data: Dict[str, Any]) -> tuple[bool, str]:
    """Deploy secrets bundle directly to Home Assistant's googlefindmy integration path.

    The add-on config maps /config (homeassistant_config:rw).
    Targets: /config/custom_components/googlefindmy/Auth/secrets.json
    """
    candidates = [
        "/config/custom_components/googlefindmy/Auth/secrets.json",
        "/homeassistant/custom_components/googlefindmy/Auth/secrets.json",
    ]
    written = False
    written_path = ""
    for path in candidates:
        dir_name = os.path.dirname(path)
        if os.path.exists(os.path.dirname(dir_name)):  # if custom_components/googlefindmy exists
            try:
                os.makedirs(dir_name, exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(secrets_data, f, indent=2)
                written = True
                written_path = path
                _LOGGER.info("Successfully exported Find My secrets to %s", path)
                break
            except Exception as err:
                _LOGGER.warning("Could not write to %s: %s", path, err)

    if written:
        return True, written_path
    return False, "Google Find My integration directory not found in /config/custom_components/googlefindmy"
