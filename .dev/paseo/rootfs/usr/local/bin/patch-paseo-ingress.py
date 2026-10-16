#!/usr/bin/env python3
"""
Paseo Web UI Ingress Patcher & Auto-Connect for Home Assistant OS.
1. Patches Paseo Express web-ui.js to pre-seed @paseo:daemon-registry in localStorage
   with the local daemon's serverId and cache HA Ingress path prefix.
2. Patches Expo Router JS bundle for Ingress path stripping, Ingress WebSocket routing,
   bypassing the Welcome onboarding screen directly to /open-project, and extending probe timeouts.
"""

import glob
import os
import re


def patch_web_ui_server():
    candidates = [
        "/usr/lib/node_modules/@getpaseo/cli/node_modules/@getpaseo/server/dist/server/server/web-ui.js",
        "/usr/lib/node_modules/@getpaseo/server/dist/server/server/web-ui.js",
    ]
    server_js = None
    for c in candidates:
        if os.path.isfile(c):
            server_js = c
            break

    if not server_js:
        print("[Paseo-Ingress] web-ui.js not found, skipping server patch.")
        return

    with open(server_js, "r", encoding="utf-8") as f:
        code = f.read()

    # If already patched previously, cleanly strip the injected wrapper
    if "function _orig_injectConnectionHint_unused" in code:
        idx_start = code.find("function injectConnectionHint(")
        idx_orig = code.find("function _orig_injectConnectionHint_unused(")
        if idx_start != -1 and idx_orig != -1:
            code = code[:idx_start] + code[idx_orig:].replace(
                "function _orig_injectConnectionHint_unused(", "function injectConnectionHint(", 1
            )

    p_func = r"function injectConnectionHint\(html, req, label\) \{"
    if re.search(p_func, code):
        r_func = """function injectConnectionHint(html, req, label) {
    const host = typeof req.headers.host === "string" ? req.headers.host : "";
    const useTls = req.protocol === "https";
    const hint = {
        listen: host,
        useTls,
        label,
    };
    let serverId = "srv_homeassistant";
    try {
        const sidPath = "/root/.paseo/server-id";
        serverId = readFileSync(sidPath, "utf8").trim() || serverId;
    } catch(e) {}
    let extraHosts = [];
    try {
        const extraPath = "/root/.paseo/extra-hosts.json";
        extraHosts = JSON.parse(readFileSync(extraPath, "utf8")) || [];
    } catch(e) {}
    const autoSeed = `<script>
window.__PASEO_INITIAL_DAEMON_CONNECTION__=${serializeInlineScriptJson(hint)};
(function(){
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (window.location && window.location.pathname) {
      var m = window.location.pathname.match(/^(\\/api\\/hassio_ingress\\/[^\\/]+)/);
      if (m) {
        window.__HA_INGRESS_PATH__ = m[1];
        try { sessionStorage.setItem("ha_ingress_pfx", m[1]); } catch(e) {}
      }
    }
    var sid = ${JSON.stringify(serverId)};
    var now = new Date().toISOString();
    var kReg = "@paseo:daemon-registry";
    var list = [];
    try { list = JSON.parse(localStorage.getItem(kReg)) || []; } catch(e) { list = []; }
    if (!Array.isArray(list)) list = [];

    var haIdx = -1;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;
      if (it.serverId === sid ||
          (it.label === "Home Assistant" && (it.serverId === "srv_homeassistant" || (typeof it.serverId === "string" && it.serverId.startsWith("local:")))) ||
          (Array.isArray(it.connections) && it.connections.some(function(c) {
            return c && (c.endpoint === "localhost:6767" || c.endpoint === "127.0.0.1:6767" || c.endpoint === "ha-local");
          }))) {
        haIdx = i;
        break;
      }
    }

    var haProfile = {
      serverId: sid,
      label: "Home Assistant",
      appearance: { color: "green", badgeDisplay: null },
      lifecycle: {},
      connections: [{
        id: "direct:localhost:6767",
        type: "directTcp",
        endpoint: "localhost:6767",
        useTls: false
      }],
      preferredConnectionId: "direct:localhost:6767",
      createdAt: now,
      updatedAt: now
    };

    if (haIdx >= 0) {
      haProfile.createdAt = list[haIdx].createdAt || now;
      list[haIdx] = haProfile;
    } else {
      list.unshift(haProfile);
    }

    var extraHosts = ${JSON.stringify(extraHosts)};
    if (Array.isArray(extraHosts)) {
      for (var j = 0; j < extraHosts.length; j++) {
        var extra = extraHosts[j];
        if (!extra || !extra.serverId) continue;
        var exIdx = -1;
        for (var k = 0; k < list.length; k++) {
          if (list[k] && list[k].serverId === extra.serverId) {
            exIdx = k;
            break;
          }
        }
        if (exIdx >= 0) {
          list[exIdx] = Object.assign({}, extra, { updatedAt: now });
        } else {
          list.push(Object.assign({}, extra, { createdAt: now, updatedAt: now }));
        }
      }
    }

    localStorage.setItem(kReg, JSON.stringify(list));

    var kSel = "paseo:last-workspace-route-selection";
    var curSel = localStorage.getItem(kSel);
    var sel = null;
    try { sel = JSON.parse(curSel); } catch(e) {}
    if (!sel || !sel.workspaceId) {
      localStorage.setItem(kSel, JSON.stringify({
        serverId: sid,
        workspaceId: "wks_config_ha"
      }));
    } else if (sel.serverId && (sel.serverId === "srv_homeassistant" || sel.serverId.startsWith("local:"))) {
      sel.serverId = sid;
      localStorage.setItem(kSel, JSON.stringify(sel));
    }
  } catch(e) {}
})();
</script>`;
    const headClose = /<\\/head>/i;
    if (headClose.test(html)) {
        return html.replace(headClose, `${autoSeed}</head>`);
    }
    return autoSeed + html;
}
function _orig_injectConnectionHint_unused(html, req, label) {
"""
        code = re.sub(p_func, r_func, code, count=1)
        with open(server_js, "w", encoding="utf-8") as f:
            f.write(code)
        print(f"[Paseo-Ingress] [✓] Successfully patched {server_js}")


def patch_web_bundle():
    base_dir = (
        "/usr/lib/node_modules/@getpaseo/cli/node_modules/@getpaseo/server/dist/server/web-ui/_expo/static/js/web"
    )
    candidates = glob.glob(os.path.join(base_dir, "index-*.js"))
    if not candidates:
        candidates = glob.glob("/usr/lib/node_modules/**/web-ui/_expo/static/js/web/index-*.js", recursive=True)
    if not candidates:
        print("[Paseo-Ingress] No Paseo Web UI bundle found.")
        return

    for js_path in candidates:
        if js_path.endswith(".gz") or js_path.endswith(".br"):
            continue
        print(f"[Paseo-Ingress] Inspecting bundle: {js_path}")
        with open(js_path, "r", encoding="utf-8") as f:
            code = f.read()

        changed = False

        # 1. extractExpoPathFromURL in module 739: strip HA Ingress path so index route matches
        t1 = 'e.extractExpoPathFromURL=function(t,o=""){return n(o).replace(/^\\//,\'\')}}'
        r1 = 'e.extractExpoPathFromURL=function(t,o=""){return n(o).replace(/^\\/?api\\/hassio_ingress\\/[^\\/]+/,\'\').replace(/^\\//,\'\')}}'
        if t1 in code:
            code = code.replace(t1, r1, 1)
            changed = True
            print("  [✓] Patched target 1 (extractExpoPathFromURL)")

        # 2. buildDaemonWebSocketUrl: connect to Ingress WebSocket under /api/hassio_ingress/<token>/ws for local daemon,
        # or direct host if outside Ingress, or standard remote URL for remote hosts.
        t2_pattern = r'e\.buildDaemonWebSocketUrl=function\(t,o\)\{.*?(const\{host:n,port:s,isIpv6:l\}=c\(t\),u=o\.useTls\?"wss":"ws";return new URL\(`\$\{u\}://\$\{l\?`\[\$\{n\}\]`:n\}:\$\{s\}/ws`\)\.toString\(\)\})'
        r2 = (
            'e.buildDaemonWebSocketUrl=function(t,o){'
            'if(typeof window!=="undefined"&&window.location){'
            'const isLocal=!t||t==="ha-local"||t==="ha-local:6767"||t==="localhost:6767"||t==="127.0.0.1:6767"||t===window.location.host;'
            'if(isLocal){'
            'const pfx=window.__HA_INGRESS_PATH__||(window.location.pathname.match(/^(\\/api\\/hassio_ingress\\/[^\\/]+)/)?.[1])||(function(){try{return sessionStorage.getItem("ha_ingress_pfx")||"";}catch(e){return"";}})();'
            'const p=window.location.protocol==="https:"?"wss:":"ws:";'
            'if(pfx){return `${p}//${window.location.host}${pfx}/ws`;}'
            'return `${p}//${window.location.host}/ws`;'
            '}'
            '}'
            '\\1'
        )
        if re.search(t2_pattern, code):
            code = re.sub(t2_pattern, r2, code, count=1)
            changed = True
            print("  [✓] Patched target 2 (buildDaemonWebSocketUrl)")

        # 3. getPathFromState in getLinkingConfig: retain Ingress prefix during in-app navigation
        t3 = "getPathFromState:(t,n)=>(0,u.getPathFromState)(t,Object.assign({},R,n,{screens:R.screens??n?.screens??{}}))??'/'"
        r3 = 'getPathFromState:(t,n)=>{const p=(0,u.getPathFromState)(t,Object.assign({},R,n,{screens:R.screens??n?.screens??{}}))??\'/\';if(typeof window!=="undefined"&&window.location){const pfx=window.__HA_INGRESS_PATH__||(window.location.pathname.match(/^(\\/api\\/hassio_ingress\\/[^\\/]+)/)?.[1])||(function(){try{return sessionStorage.getItem("ha_ingress_pfx")||"";}catch(e){return"";}})();if(pfx){return p===\'/\'?pfx+\'/\':pfx+p;}}return p;}'
        if t3 in code:
            code = code.replace(t3, r3, 1)
            changed = True
            print("  [✓] Patched target 3 (getPathFromState)")

        # 4. module 787 URL location: sanitize initial location for all React components
        t4 = "if(o instanceof URL)t={location:{pathname:o.pathname+o.hash,search:o.search}};"
        r4 = "if(o instanceof URL){const pn=o.pathname.replace(/^\\/?api\\/hassio_ingress\\/[^\\/]+/,'')||'/';t={location:{pathname:pn+o.hash,search:o.search}};} "
        if t4 in code:
            code = code.replace(t4, r4, 1)
            changed = True
            print("  [✓] Patched target 4 (module 787 URL)")

        # 5. resolveKnownHostRoute: always redirect to /open-project instead of /welcome onboarding screen
        t5 = 'if(t.hosts.length>0)return{kind:"redirect",href:"/open-project"};return{kind:"redirect",href:"/welcome"}'
        r5 = 'return{kind:"redirect",href:"/open-project"}'
        if t5 in code:
            code = code.replace(t5, r5, 1)
            changed = True
            print("  [✓] Patched target 5 (resolveKnownHostRoute -> /open-project)")

        # 6. WelcomeScreen: auto-redirect immediately to /open-project if ever mounted
        t6 = "W[3]!==$||W[4]!==F?(ee=()=>{$&&F.replace((0,w.buildOpenProjectRoute)())},te=[$,F],W[3]=$,W[4]=F,W[5]=ee,W[6]=te):(ee=W[5],te=W[6]);(0,l.useEffect)(ee,te),"
        r6 = "ee=()=>{F.replace((0,w.buildOpenProjectRoute)())};(0,l.useEffect)(ee,[F]),"
        if t6 in code:
            code = code.replace(t6, r6, 1)
            changed = True
            print("  [✓] Patched target 6 (WelcomeScreen auto-redirect)")

        # 7. Extend connection timeout from 2.5s to 30s so Ingress WebSocket probe never aborts prematurely
        t7 = 'pe="@paseo:daemon-registry",ge="localhost:6767",ye=2500'
        r7 = 'pe="@paseo:daemon-registry",ge="localhost:6767",ye=30000'
        if t7 in code:
            code = code.replace(t7, r7, 1)
            changed = True
            print("  [✓] Patched target 7 (ye=30000 timeout)")

        # 8. Host controller serverId reconciliation: reconcile mismatch instead of throwing & closing WebSocket
        t8 = 'if(t!==this.host.serverId){if(!be(this.host.serverId)||!this.onReconcileServerId)throw await e.close().catch(()=>{}),new Error(`Connection resolved to ${t}, expected ${this.host.serverId}.`);this.onReconcileServerId(this.host.serverId,t)}'
        r8 = 'if(t!==this.host.serverId){try{if(this.onReconcileServerId)this.onReconcileServerId(this.host.serverId,t);}catch(err){}this.host.serverId=t;}'
        if t8 in code:
            code = code.replace(t8, r8, 1)
            changed = True
            print("  [✓] Patched target 8 (host serverId reconciliation)")

        if changed:
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(code)
            # Remove pre-compressed files so Express serves the newly patched bundle
            for ext in [".gz", ".br"]:
                comp = js_path + ext
                if os.path.isfile(comp):
                    os.remove(comp)
                    print(f"  [✓] Removed pre-compressed asset: {comp}")
            print(f"[Paseo-Ingress] Bundle {os.path.basename(js_path)} successfully patched.")
        else:
            print(f"[Paseo-Ingress] Bundle {os.path.basename(js_path)} already patched or targets matched.")


def patch_server_hostnames():
    candidates = [
        "/usr/lib/node_modules/@getpaseo/cli/node_modules/@getpaseo/server/dist/server/server/hostnames.js",
        "/usr/lib/node_modules/@getpaseo/server/dist/server/server/hostnames.js",
    ]
    for p in candidates:
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                code = f.read()
            p_func = r"export function isHostnameAllowed\(hostHeader, hostnames\) \{"
            r_func = "export function isHostnameAllowed(hostHeader, hostnames) {\n    return true;"
            if (
                re.search(p_func, code)
                and "return true;" not in code.split("export function isHostnameAllowed")[1][:60]
            ):
                code = re.sub(p_func, r_func, code, count=1)
                with open(p, "w", encoding="utf-8") as f:
                    f.write(code)
                print(f"[Paseo-Ingress] [✓] Successfully patched {p} to allow all hostnames")


def patch_bootstrap():
    candidates = [
        "/usr/lib/node_modules/@getpaseo/cli/node_modules/@getpaseo/server/dist/server/server/bootstrap.js",
        "/usr/lib/node_modules/@getpaseo/server/dist/server/server/bootstrap.js",
    ]
    for p in candidates:
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                code = f.read()
            t = "if (!isHostnameAllowed(hostHeader, configuredHostnames)) {"
            r = "if (false && !isHostnameAllowed(hostHeader, configuredHostnames)) {"
            if t in code:
                code = code.replace(t, r, 1)
                with open(p, "w", encoding="utf-8") as f:
                    f.write(code)
                print(f"[Paseo-Ingress] [✓] Successfully bypassed Host header check in {p}")


if __name__ == "__main__":
    patch_server_hostnames()
    patch_bootstrap()
    patch_web_ui_server()
    patch_web_bundle()
