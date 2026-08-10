// Update & Dependency Modals

function openUpdateModal(type) {
  const data = window._latestReleaseData || {};
  const modal = document.getElementById('version-update-modal');
  const title = document.getElementById('update-modal-title');
  const currVer = document.getElementById('update-curr-ver');
  const newVer = document.getElementById('update-new-ver');
  const newVerPill = document.getElementById('update-new-ver-pill');
  const changelog = document.getElementById('update-changelog-content');
  const actionBtn = document.getElementById('update-action-btn');

  let currentVersion = 'N/A';
  let latestVersion = null;
  let changelogText = '';
  let repoUrl = '';
  let directUpdateUrl = '';
  let compName = '';

  if (type === 'addon') {
    compName = 'WhatsApp Addon';
    currentVersion = data.addonVersion || 'N/A';
    latestVersion = data.latestAddonVersion || null;
    changelogText = data.addonChangelog || 'No release notes available.';
    repoUrl = data.addonReleaseUrl || 'https://github.com/FaserF/hassio-addons/releases';
    directUpdateUrl = data.isStandalone
      ? repoUrl
      : 'https://my.home-assistant.io/redirect/supervisor_addon/?addon=whatsapp';
  } else if (type === 'integration') {
    compName = 'WhatsApp Integration';
    currentVersion = data.integrationVersion || 'N/A';
    latestVersion = data.latestIntegrationVersion || null;
    changelogText = data.integrationChangelog || 'No release notes available.';
    repoUrl = data.integrationReleaseUrl || 'https://github.com/FaserF/ha-whatsapp/releases';
    directUpdateUrl =
      'https://my.home-assistant.io/redirect/hacs_repository/?owner=FaserF&repository=ha-whatsapp&category=integration';
  }

  // Check if latest version is actually newer than current
  const isNewer =
    typeof window.isNewerVersion === 'function'
      ? window.isNewerVersion(currentVersion, latestVersion)
      : latestVersion && latestVersion !== currentVersion;

  if (title)
    title.textContent = isNewer
      ? window.t
        ? window.t('dashboard.update_available_title', { name: compName })
        : `${compName} Update Available`
      : window.t
        ? window.t('dashboard.info_title', { name: compName })
        : `${compName} Info`;
  if (currVer) currVer.textContent = currentVersion;
  if (newVer)
    newVer.textContent =
      latestVersion || (window.t ? window.t('dashboard.up_to_date') : 'Up to date');

  if (newVerPill) {
    if (!isNewer) {
      newVerPill.style.background = 'rgba(134, 150, 160, 0.15)';
      newVerPill.style.color = 'var(--text-muted)';
    } else {
      newVerPill.style.background = 'var(--primary-glow)';
      newVerPill.style.color = 'var(--primary)';
    }
  }

  if (changelog) changelog.innerHTML = escapeHtml(changelogText);

  if (actionBtn) {
    if (isNewer) {
      actionBtn.href = directUpdateUrl;
      actionBtn.innerHTML =
        '<i class="fas fa-download"></i> ' +
        (window.t ? window.t('dashboard.update_now') : 'Update Now');
      actionBtn.style.display = 'inline-flex';
    } else {
      actionBtn.href = repoUrl;
      actionBtn.innerHTML =
        '<i class="fab fa-github"></i> ' +
        (window.t ? window.t('dashboard.view_repo') : 'View Repository');
      actionBtn.style.display = 'inline-flex';
    }
    actionBtn.target = '_blank';
  }

  if (modal) modal.classList.add('show');
}

function closeUpdateModal() {
  const modal = document.getElementById('version-update-modal');
  if (modal) modal.classList.remove('show');
}

function openDependencyModal(depName) {
  const data = window._latestReleaseData || {};
  const modal = document.getElementById('dependency-info-modal');
  const title = document.getElementById('dep-modal-title');
  const currVer = document.getElementById('dep-curr-ver');
  const addonStatus = document.getElementById('dep-addon-status');
  const addonStatusPill = document.getElementById('dep-addon-status-pill');
  const rationaleBox = document.getElementById('dep-rationale-box');
  const rationaleIcon = document.getElementById('dep-rationale-icon');
  const rationaleTitle = document.getElementById('dep-rationale-title');
  const rationaleDesc = document.getElementById('dep-rationale-desc');
  const roleDesc = document.getElementById('dep-role-desc');
  const repoBtn = document.getElementById('dep-repo-btn');
  const releasesBtn = document.getElementById('dep-releases-btn');
  const actionBtn = document.getElementById('dep-action-btn');

  const depInfo = {
    Baileys: {
      repo: 'https://github.com/WhiskeySockets/Baileys',
      releases: 'https://github.com/WhiskeySockets/Baileys/releases',
      version: data.baileysVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_baileys') : 'WhatsApp Web Protocol Engine',
    },
    'Node.js': {
      repo: 'https://github.com/nodejs/node',
      releases: 'https://github.com/nodejs/node/releases',
      version: data.nodeVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_nodejs') : 'JavaScript Runtime Environment',
    },
    Express: {
      repo: 'https://github.com/expressjs/express',
      releases: 'https://github.com/expressjs/express/releases',
      version: data.expressVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_express') : 'REST API & Web UI Framework',
    },
    'Alpine Linux': {
      repo: 'https://alpinelinux.org',
      releases: 'https://alpinelinux.org/releases/',
      version: data.alpineVersion || 'N/A',
      role: window.t ? window.t('dashboard.role_alpine') : 'Base Docker Operating System',
    },
  };

  const info = depInfo[depName] || {
    repo: 'https://github.com',
    releases: 'https://github.com',
    version: 'N/A',
    role: window.t ? window.t('dashboard.role_core_gateway') : 'Core Gateway Component',
  };

  const hasAddonUpdate =
    typeof window.isNewerVersion === 'function'
      ? window.isNewerVersion(data.addonVersion, data.latestAddonVersion)
      : false;

  if (title)
    title.textContent = window.t
      ? window.t('dashboard.dep_info_title', { depName })
      : `${depName} Dependency Info`;
  if (currVer) currVer.textContent = info.version;
  if (roleDesc) roleDesc.textContent = info.role;

  if (addonStatus) {
    addonStatus.textContent = hasAddonUpdate
      ? window.t
        ? window.t('dashboard.update_available_ver', { version: data.latestAddonVersion })
        : `Update Available (${data.latestAddonVersion})`
      : window.t
        ? window.t('dashboard.addon_up_to_date')
        : 'Addon Up to date';
  }

  if (addonStatusPill) {
    if (hasAddonUpdate) {
      addonStatusPill.style.background = 'var(--primary-glow)';
      addonStatusPill.style.color = 'var(--primary)';
    } else {
      addonStatusPill.style.background = 'rgba(134, 150, 160, 0.15)';
      addonStatusPill.style.color = 'var(--text-muted)';
    }
  }

  if (rationaleBox && rationaleIcon && rationaleTitle && rationaleDesc) {
    if (hasAddonUpdate) {
      rationaleBox.className = 'update-rationale-box';
      rationaleIcon.className = 'fas fa-arrow-alt-circle-up rationale-icon';
      rationaleIcon.style.color = 'var(--primary)';
      rationaleTitle.textContent = window.t
        ? window.t('dashboard.addon_update_pending')
        : 'Addon Update Pending';
      rationaleDesc.textContent = window.t
        ? window.t('dashboard.addon_update_pending_desc', {
            version: data.latestAddonVersion,
            depName,
          })
        : `A newer Addon release (${data.latestAddonVersion}) is ready! Updating your Addon will automatically upgrade ${depName}.`;
    } else {
      rationaleBox.className = 'update-rationale-box warning';
      rationaleIcon.className = 'fas fa-info-circle rationale-icon';
      rationaleIcon.style.color = 'var(--warning)';
      rationaleTitle.textContent = window.t
        ? window.t('dashboard.bundled_dep_mgmt')
        : 'Bundled Dependency Management';
      rationaleDesc.textContent = window.t
        ? window.t('dashboard.bundled_dep_mgmt_desc', { depName })
        : `${depName} is bundled inside the WhatsApp Addon container and is updated with each Addon release.`;
    }
  }

  if (repoBtn) repoBtn.href = info.repo;
  if (releasesBtn) releasesBtn.href = info.releases;

  if (actionBtn) {
    if (hasAddonUpdate) {
      actionBtn.className = 'btn btn-primary btn-sm';
      actionBtn.innerHTML =
        '<i class="fas fa-download"></i> ' +
        (window.t ? window.t('dashboard.update_addon_now') : 'Update Addon Now');
      actionBtn.href = data.isStandalone
        ? data.addonReleaseUrl || 'https://github.com/FaserF/hassio-addons/releases'
        : 'https://my.home-assistant.io/redirect/supervisor_addon/?addon=whatsapp';
      actionBtn.target = '_blank';
    } else {
      actionBtn.className = 'btn btn-secondary btn-sm';
      actionBtn.innerHTML =
        '<i class="fab fa-github"></i> ' +
        (window.t ? window.t('dashboard.report_issue') : 'Report Vulnerability / Issue');
      actionBtn.href = 'https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml';
      actionBtn.target = '_blank';
    }
  }

  if (modal) modal.classList.add('show');
}

function closeDependencyModal() {
  const modal = document.getElementById('dependency-info-modal');
  if (modal) modal.classList.remove('show');
}
