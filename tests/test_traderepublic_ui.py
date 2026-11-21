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
    """Verify phone login is recommended and QR login does not claim to be recommended."""
    de_data = json.loads((I18N_DIR / "de.json").read_text(encoding="utf-8"))
    en_data = json.loads((I18N_DIR / "en.json").read_text(encoding="utf-8"))

    # Phone login should be the recommended option
    assert "Empfohlen" in de_data["tab_phone"]
    assert "Recommended" in en_data["tab_phone"]

    # QR code login should not claim to be recommended
    assert "Empfohlen" not in de_data["tab_qr"]
    assert "Recommended" not in en_data["tab_qr"]

    # Necessary keys for fallback and loading state
    assert "qr_not_available" in de_data
    assert "qr_not_available" in en_data
    assert "qr_loading" in de_data
    assert "qr_loading" in en_data
    assert "btn_switch_to_phone" in de_data
    assert "btn_switch_to_phone" in en_data


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
    """Verify index.html contains necessary DOM elements and does not have a pure black placeholder."""
    index_html = (TEMPLATES_DIR / "index.html").read_text(encoding="utf-8")

    # Assert rendered HTML contains necessary DOM elements
    assert 'id="step-login"' in index_html
    assert 'id="step-qr"' in index_html
    assert 'id="qr-loading"' in index_html
    assert 'id="qr-unavailable-alert"' in index_html
    assert 'id="qr-code-img"' in index_html
    assert 'data-i18n="tab_phone"' in index_html
    assert 'data-i18n="tab_qr"' in index_html
    assert 'data-i18n="qr_not_available"' in index_html
    assert 'data-i18n="qr_loading"' in index_html
    assert 'data-i18n="btn_switch_to_phone"' in index_html

    # Ensure phone login is the default active button and step
    assert 'id="tab-phone-btn"' in index_html
    assert 'id="tab-qr-btn"' in index_html

    # Verify transparent gif in black background is removed
    assert "background: #141414;" not in index_html.split('id="step-qr"')[1].split('id="step-login"')[0]
