#!/usr/bin/env python3
"""Start the real API against an explicit isolated PostgreSQL CI database and run the shared smoke."""
import argparse
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import time
import urllib.error
import urllib.request

from generate_dev_env import protect_private_directory


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5080)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    connection = os.environ.get('SUSUMU_DB_CONNECTION', '')
    fields = dict(part.strip().lower().split('=', 1) for part in connection.split(';') if '=' in part)
    if fields.get('host') not in ('127.0.0.1', 'localhost') or not re.fullmatch(r'susumu_ci(?:_[a-z0-9]+)?', fields.get('database', '')):
        raise SystemExit('Set SUSUMU_DB_CONNECTION to an isolated loopback susumu_ci[_suffix] database.')
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1', args.port)) == 0:
            raise SystemExit('CI API port already in use; existing services will not be touched.')
    assembly = root / 'backend/src/Susumu.Api/bin/Release/net10.0/Susumu.Api.dll'
    if not assembly.is_file():
        raise SystemExit('Build the backend Release configuration before the PostgreSQL smoke.')
    protect_private_directory(root)
    env = os.environ.copy()
    password = secrets.token_hex(24)
    env.update({
        'ASPNETCORE_ENVIRONMENT': 'Development',
        'ASPNETCORE_URLS': f'http://127.0.0.1:{args.port}',
        'SUSUMU_JWT_SIGNING_KEY': secrets.token_hex(48),
        'SUSUMU_DB_PROVIDER': 'postgres',
        'Database__ApplyMigrationsAtStartup': 'true',
        'SUSUMU_PHOTO_ROOT': str(root / '.local' / ('ci-photos-' + secrets.token_hex(6))),
        'SUSUMU_DEV_SEED': 'true', 'SUSUMU_BOOTSTRAP_ADMIN_PASSWORD': password,
        'SUSUMU_BOOTSTRAP_ADMIN_USERNAME': 'admin',
        'DevSeed__CredentialsFilePath': str(root / '.local' / ('ci-seed-' + secrets.token_hex(6) + '.json')),
        'SUSUMU_TEST_USERNAME': 'admin', 'SUSUMU_TEST_PASSWORD': password,
        'SUSUMU_API_URL': f'http://127.0.0.1:{args.port}/api/v1/',
    })
    artifacts = root / 'artifacts' / 'integration'
    artifacts.mkdir(parents=True, exist_ok=True)
    with (artifacts / 'ci-api.log').open('wb') as log:
        api = subprocess.Popen(['dotnet', str(assembly)], env=env, cwd=root, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                if api.poll() is not None:
                    raise RuntimeError('API exited before readiness; inspect artifacts/integration/ci-api.log locally.')
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{args.port}/api/v1/health/ready', timeout=2) as response:
                        if response.status == 200:
                            break
                except (OSError, urllib.error.URLError):
                    pass
                time.sleep(0.5)
            else:
                raise RuntimeError('API readiness did not pass against PostgreSQL; CI fails rather than skipping integration.')
            subprocess.run(['node', 'tests/integration/api-smoke.mjs'], cwd=root, env=env, check=True)
        finally:
            api.terminate()
            try:
                api.wait(timeout=15)
            except subprocess.TimeoutExpired:
                api.kill()
                api.wait(timeout=5)


if __name__ == '__main__':
    main()
