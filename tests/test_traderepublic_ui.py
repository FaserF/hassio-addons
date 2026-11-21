"""Unit tests for Trade Republic add-on login UI and translations."""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TR_DIR = REPO_ROOT / "traderepublic"
I18N_DIR = TR_DIR / "app" / "static" / "i18n"
TEMPLATES_DIR = TR_DIR / "app" / "templates"


def test_i18n_files_exist_and_valid():
    """Verify German and English translation files exist and are valid JSON."""
    de_file = I18N_DIR / "de.json"
    en_file = I18N_DIR / "en.json"

    assert de_file.is_file(), "de.json must exist"
    assert en_file.is_file(), "en.json must exist"

    de_data = json.loads(de_file.read_text(encoding="utf-8"))
    en_data = json.loads(en_file.read_text(encoding="utf-8"))

    assert isinstance(de_data, dict)
    assert isinstance(en_data, dict)


def test_i18n_qr_and_phone_labels():
    """Verify unified login text, hint and credentials divider exist."""
    de_data = json.loads((I18N_DIR / "de.json").read_text(encoding="utf-8"))
    en_data = json.loads((I18N_DIR / "en.json").read_text(encoding="utf-8"))

    # Unified login headers and hints
    assert "login_unified_title" in de_data
    assert "login_unified_title" in en_data
    assert "login_unified_hint" in de_data
    assert "login_unified_hint" in en_data
    assert "divider_or_credentials" in de_data
    assert "divider_or_credentials" in en_data

    # Necessary keys for fallback and loading state
    assert "qr_not_available" in de_data
    assert "qr_not_available" in en_data
    assert "qr_loading" in de_data
    assert "qr_loading" in en_data


def test_i18n_keys_parity():
    """Ensure all translation keys exist in both German and English files."""
    de_data = json.loads((I18N_DIR / "de.json").read_text(encoding="utf-8"))
    en_data = json.loads((I18N_DIR / "en.json").read_text(encoding="utf-8"))

    de_keys = set(de_data.keys())
    en_keys = set(en_data.keys())

    missing_in_en = de_keys - en_keys
    missing_in_de = en_keys - de_keys

    assert not missing_in_en, f"Keys in de.json missing from en.json: {missing_in_en}"
    assert not missing_in_de, f"Keys in en.json missing from de.json: {missing_in_de}"


def test_index_html_structure():
    """Verify index.html contains unified step-login with both QR code and Phone/PIN input."""
    index_html = (TEMPLATES_DIR / "index.html").read_text(encoding="utf-8")

    # Assert rendered HTML contains necessary DOM elements
    assert 'id="step-login"' in index_html
    assert 'id="step-qr"' in index_html
    assert 'id="qr-loading"' in index_html
    assert 'id="qr-unavailable-alert"' in index_html
    assert 'id="qr-code-img"' in index_html
    assert 'data-i18n="login_unified_title"' in index_html
    assert 'data-i18n="login_unified_hint"' in index_html
    assert 'data-i18n="divider_or_credentials"' in index_html
    assert 'id="phone"' in index_html
    assert 'id="pin"' in index_html

    # Ensure step-qr is inside step-login for single unified step
    step_login_block = index_html.split('id="step-login"')[1].split('id="step-2fa"')[0]
    assert 'id="step-qr"' in step_login_block
    assert 'id="phone"' in step_login_block
    assert 'id="pin"' in step_login_block

    # Verify transparent gif in pitch-black background is removed
    assert "background: #141414;" not in step_login_block
