#!/usr/bin/env python3
"""Deploy web/dist to Cloudflare Pages including Advanced Mode _worker.js.

cf-publish uploads _worker.js as a static file (broken). Pages expects it as a
multipart form field on the deployment request — same as wrangler.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
from cf_publish.pages import (
    Pages,
    PagesError,
    SPECIAL_FILES,
    collect,
    file_hash,
    load_env_file,
    upload_assets,
)

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
WORKER_NAME = "_worker.js"
PROJECT = os.environ.get("CF_PAGES_PROJECT", "bisync-rms-mobile")
BRANCH = os.environ.get("CF_PAGES_BRANCH", "main")


def deploy_with_worker(directory: Path, project: str, branch: str) -> str:
    load_env_file()
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        raise PagesError("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID")

    if not directory.is_dir():
        raise PagesError(f"not a directory: {directory}")

    files = collect(directory)

    special: dict[str, bytes] = {}
    for name in SPECIAL_FILES:
        p = files.pop("/" + name, None)
        if p is not None:
            special[name] = p.read_bytes()

    worker_path = files.pop("/" + WORKER_NAME, None)
    if worker_path is None:
        raise PagesError(f"missing {directory / WORKER_NAME}")
    worker_bytes = worker_path.read_bytes()

    manifest: dict[str, str] = {}
    by_hash: dict[str, Path] = {}
    for url_path, p in files.items():
        h = file_hash(p.read_bytes(), p.suffix.lstrip("."))
        manifest[url_path] = h
        by_hash[h] = p

    print(
        f"{len(files)} files ({len(by_hash)} unique)"
        + (f" + {', '.join(sorted(special))}" if special else "")
        + f" + {WORKER_NAME}"
    )

    pages = Pages(account, token)
    if not pages.project_exists(project):
        pages.create_project(project)
        print(f"created project: {project}")

    jwt = pages.upload_token(project)
    uploaded = upload_assets(jwt, by_hash, print)
    print(f"uploaded {uploaded} assets")

    # Attach _worker.js as a deployment form field (not a static asset).
    files_form: dict = {"manifest": (None, json.dumps(manifest))}
    for name, content in special.items():
        files_form[name] = (name, content)
    files_form["_worker.js"] = (
        "_worker.js",
        worker_bytes,
        "application/javascript+module",
    )

    with httpx.Client(
        timeout=300.0,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "bisync-pages-deploy/1.0",
        },
    ) as client:
        res = client.post(
            f"https://api.cloudflare.com/client/v4/accounts/{account}"
            f"/pages/projects/{project}/deployments",
            data={"branch": branch},
            files=files_form,
        )
        data = res.json()
        if not data.get("success"):
            raise PagesError(json.dumps(data.get("errors") or data, indent=2))
        url = data["result"].get("url", "")
        print(f"deployed: {url}")
        print(f"uses_functions: {data['result'].get('uses_functions')}")
        return url


if __name__ == "__main__":
    try:
        deploy_with_worker(DIST, PROJECT, BRANCH)
    except PagesError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
