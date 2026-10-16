#!/usr/bin/env python3
"""
Paseo Web UI Ingress Patcher for Home Assistant OS.
Enables native React Navigation routing, dynamic chunk loading,
and WebSocket daemon communication under Home Assistant Ingress subpaths (/api/hassio_ingress/<token>/).
"""

import glob
import os
import re


def patch_paseo_ingress():
    base_dir = (
        "/usr/lib/node_modules/@getpaseo/cli/node_modules/@getpaseo/server/dist/server/web-ui/_expo/static/js/web"
    )
    candidates = glob.glob(os.path.join(base_dir, "index-*.js"))
    if not candidates:
        # Fallback search if installed under different node_modules path
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
        t1 = "e.extractExpoPathFromURL=function(t,o=\"\"){return n(o).replace(/^\\//,'')}}"
        r1 = "e.extractExpoPathFromURL=function(t,o=\"\"){return n(o).replace(/^\\/?api\\/hassio_ingress\\/[^\\/]+/,'').replace(/^\\//,'')}}"
        if t1 in code:
            code = code.replace(t1, r1, 1)
            changed = True
            print("  [✓] Patched target 1 (extractExpoPathFromURL)")

        # 2. buildDaemonWebSocketUrl: connect to Ingress WebSocket under /api/hassio_ingress/<token>/ws
        t2_pattern = r'e\.buildDaemonWebSocketUrl=function\(t,o\)\{const\{host:n,port:s,isIpv6:l\}=c\(t\),u=o\.useTls\?"wss":"ws";return new URL\(`\$\{u\}://\$\{l\?`\[\$\{n\}\]`:n\}:\$\{s\}/ws`\)\.toString\(\)\}'
        r2 = 'e.buildDaemonWebSocketUrl=function(t,o){if(typeof window!=="undefined"&&window.location){const m=window.location.pathname.match(/^(\\/api\\/hassio_ingress\\/[^\\/]+)/);if(m){const p=window.location.protocol==="https:"?"wss:":"ws:";return `${p}//${window.location.host}${m[1]}/ws`;}}const{host:n,port:s,isIpv6:l}=c(t),u=o.useTls?"wss":"ws";return new URL(`${u}://${l?`[${n}]`:n}:${s}/ws`).toString()}'
        if re.search(t2_pattern, code):
            code = re.sub(t2_pattern, r2, code, count=1)
            changed = True
            print("  [✓] Patched target 2 (buildDaemonWebSocketUrl)")

        # 3. getPathFromState in getLinkingConfig: retain Ingress prefix during in-app navigation
        t3 = "getPathFromState:(t,n)=>(0,u.getPathFromState)(t,Object.assign({},R,n,{screens:R.screens??n?.screens??{}}))??'/'"
        r3 = "getPathFromState:(t,n)=>{const p=(0,u.getPathFromState)(t,Object.assign({},R,n,{screens:R.screens??n?.screens??{}}))??'/';if(typeof window!==\"undefined\"&&window.location){const m=window.location.pathname.match(/^(\\/api\\/hassio_ingress\\/[^\\/]+)/);if(m){const pfx=m[1];return p==='/'?pfx+'/':pfx+p;}}return p;}"
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

        if changed:
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(code)
            # Remove pre-compressed files so Express serves the newly patched bundle
            for ext in [".gz", ".br"]:
                comp = js_path + ext
                if os.path.isfile(comp):
                    os.remove(comp)
                    print(f"  [✓] Removed pre-compressed asset: {comp}")
            print(f"[Paseo-Ingress] Bundle {os.path.basename(js_path)} successfully patched for HA Ingress.")
        else:
            print(f"[Paseo-Ingress] Bundle {os.path.basename(js_path)} already patched or targets matched.")


if __name__ == "__main__":
    patch_paseo_ingress()
