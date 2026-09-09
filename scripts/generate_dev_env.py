#!/usr/bin/env python3
"""Create ignored DEV secrets once, without displaying their values."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess


def protect_private_directory(root: Path) -> None:
    if os.name == 'nt':
        subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                        str(Path(__file__).with_name('protect-private-paths.ps1')),
                        '-Root', str(root)], check=True)
    else:
        private = root / '.local'
        private.mkdir(mode=0o700, exist_ok=True)
        private.chmod(0o700)


def write_private_exclusive(path: Path, content: str) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
        if os.name == 'nt' and path.name == '.env':
            # The exclusive file is still empty until its Windows ACL is private.
            subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                            str(Path(__file__).with_name('protect-private-paths.ps1')),
                            '-Root', str(path.parent), '-EnvFileOnly'], check=True)
        stream.write(content)


def generate(root: Path) -> None:
    root = root.resolve(strict=True)
    env_file = root / '.env'
    private_dir = root / '.local'
    credentials_file = private_dir / 'dev-credentials.json'
    if env_file.exists() or credentials_file.exists():
        raise FileExistsError('Existing .env or DEV credentials preserved; use a fresh target directory.')
    if private_dir.is_symlink():
        raise ValueError('.local must not be a symbolic link.')
    protect_private_directory(root)
    password = secrets.token_hex(24)
    signing_key = secrets.token_hex(48)
    admin_password = secrets.token_hex(24)
    content = '\n'.join([
        '# Generated DEV-only secrets. Never commit this file.',
        'COMPOSE_PROJECT_NAME=susumu-dev', 'DEV_HTTP_PORT=8080',
        'POSTGRES_DB=susumu_dev', 'POSTGRES_USER=susumu',
        f'POSTGRES_PASSWORD={password}', f'JWT_SIGNING_KEY={signing_key}',
        f'DEV_ADMIN_PASSWORD={admin_password}', 'DEV_SEED_ENABLED=true', '',
    ])
    # Exclusive file creation protects against both accidental reruns and races.
    write_private_exclusive(env_file, content)
    try:
        write_private_exclusive(credentials_file, json.dumps({
            'environment': 'Development', 'url': 'http://127.0.0.1:8080',
            'username': 'admin', 'password': admin_password,
            'note': 'Synthetic DEV seed only. Does not represent production credentials.',
        }, indent=2) + '\n')
    except Exception:
        # Leave the newly generated .env as evidence; never delete or replace a competing file.
        raise RuntimeError('DEV .env created, but credentials file could not be created; inspect .local.') from None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    generate(args.root)
    print('Created .env and .local/dev-credentials.json; secret values were not displayed.')


if __name__ == '__main__':
    main()
