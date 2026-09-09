#!/usr/bin/env python3
"""Verify the CI-owned Docker stack through its loopback Caddy entry point."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-existing', action='store_true')
    args = parser.parse_args()
    project = os.environ.get('COMPOSE_PROJECT_NAME', '')
    if os.environ.get('CI') != 'true' or not re.fullmatch(r'susumu-ci-[0-9]+-[0-9]+', project):
        raise SystemExit('This runner is restricted to explicit GitHub CI-owned susumu-ci-run-attempt projects.')
    root = Path(__file__).resolve().parents[1]
    credentials = json.loads((root / '.local/dev-credentials.json').read_text(encoding='utf-8'))
    env = os.environ.copy()
    env.update({
        'SUSUMU_API_URL': 'http://127.0.0.1:8080/api/v1/',
        'SUSUMU_TEST_USERNAME': credentials['username'],
        'SUSUMU_TEST_PASSWORD': credentials['password'],
    })
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:8080/api/v1/health/ready', timeout=3) as response:
                if response.status == 200:
                    break
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(1)
    else:
        raise SystemExit('Compose API readiness failed through Caddy; integration was not skipped.')
    with urllib.request.urlopen('http://127.0.0.1:8080/', timeout=5) as response:
        if response.status != 200 or b'<html' not in response.read().lower():
            raise SystemExit('Built admin application was not served by Caddy.')
    if args.verify_existing:
        evidence = json.loads((root / 'artifacts/api-smoke.json').read_text(encoding='utf-8'))
        body = json.dumps({'username': credentials['username'], 'password': credentials['password'],
                           'deviceId': 'ci-persistence-validation'}).encode()
        login = urllib.request.Request(env['SUSUMU_API_URL'] + 'auth/login', data=body,
                                       headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(login, timeout=10) as response:
            token = json.load(response)['accessToken']
        inspection = urllib.request.Request(env['SUSUMU_API_URL'] + 'inspections/' + evidence['inspectionId'],
                                            headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(inspection, timeout=10) as response:
            record = json.load(response)
        if record['id'] != evidence['inspectionId'] or record['state'] != 'Finalized' or record['photoUploadState'] != 'Complete':
            raise SystemExit('Recreated containers did not preserve the finalized inspection and photo state.')
        photos = record.get('photos', [])
        if not photos:
            raise SystemExit('Photo metadata was not preserved after container recreation.')
        for photo in photos:
            request = urllib.request.Request(env['SUSUMU_API_URL'] + 'inspections/' + record['id'] + '/photos/' + photo['id'],
                                             headers={'Authorization': 'Bearer ' + token})
            with urllib.request.urlopen(request, timeout=10) as response:
                import hashlib
                if hashlib.sha256(response.read()).hexdigest().lower() != photo['sha256'].lower():
                    raise SystemExit('Photo bytes changed after container recreation.')
        evidence['composeRecreationPreservedDatabaseAndPhotos'] = True
        (root / 'artifacts/api-smoke.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    else:
        subprocess.run(['node', 'tests/integration/api-smoke.mjs'], cwd=root, env=env, check=True)
    print('PostgreSQL, API and built admin verified through the Caddy same-origin entry point.')


if __name__ == '__main__':
    main()
