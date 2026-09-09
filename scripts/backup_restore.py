#!/usr/bin/env python3
"""Consistent DEV/test PostgreSQL + photos backups and non-destructive restore validation."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile

FILES = ('database.dump', 'photos.tar.gz', 'metadata.json')


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def pg_tool(name: str, pg_bin: str | None) -> str:
    if pg_bin:
        path = Path(pg_bin) / (name + ('.exe' if os.name == 'nt' else ''))
        if not path.is_file():
            raise ValueError(f'PostgreSQL tool not found: {path}')
        return str(path)
    executable = shutil.which(name)
    if not executable:
        raise ValueError(f'{name} not on PATH; pass --pg-bin.')
    return executable


def run_pg(name: str, arguments: list[str], pg_bin: str | None, env: dict) -> str:
    result = subprocess.run([pg_tool(name, pg_bin), *arguments], env=env,
                            capture_output=True, text=True, check=False)
    if result.returncode:
        # Keep connection diagnostics local; do not echo connection strings or credentials.
        raise RuntimeError(f'{name} failed with exit code {result.returncode}; verify PostgreSQL connection and permissions.')
    return result.stdout.strip()


def connection_env() -> dict:
    env = os.environ.copy()
    for key in ('PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE'):
        if not env.get(key):
            raise ValueError(f'{key} must be explicitly set in the process environment.')
    env['PGCONNECT_TIMEOUT'] = '10'
    return env


def validate_archive(archive: Path) -> None:
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar.getmembers():
            path = PurePosixPath(member.name)
            if (path.is_absolute() or '..' in path.parts or '\\' in member.name
                    or ':' in member.name or not (member.isfile() or member.isdir())):
                raise ValueError('Unsafe photo archive entry; restore refused.')


def verify_bundle(bundle: Path) -> dict:
    manifest = json.loads((bundle / 'sha256.json').read_text(encoding='utf-8'))
    if set(manifest) != set(FILES):
        raise ValueError('Backup manifest has unexpected or missing files.')
    for name in FILES:
        path = bundle / name
        if path.is_symlink() or not path.is_file() or sha256(path) != manifest[name]:
            raise ValueError(f'Backup integrity failed for {name}.')
    validate_archive(bundle / 'photos.tar.gz')
    metadata = json.loads((bundle / 'metadata.json').read_text(encoding='utf-8'))
    if metadata.get('formatVersion') != 1 or not metadata.get('writersStopped'):
        raise ValueError('Unsupported or incomplete backup metadata.')
    return metadata


def backup(args) -> None:
    if not args.writers_stopped:
        raise ValueError('Stop all API/background writers first, then pass --writers-stopped.')
    env = connection_env()
    photos = args.photos.resolve(strict=True)
    if not photos.is_dir() or args.photos.is_symlink():
        raise ValueError('Photo source must be a real directory.')
    output = args.output.resolve()
    if output == photos or output.is_relative_to(photos):
        raise ValueError('Backup output must be outside photo storage.')
    if output.exists():
        raise FileExistsError('Backup output already exists; choose a new directory.')
    output.mkdir(parents=True, mode=0o700)
    run_pg('pg_dump', ['--format=custom', '--no-owner', '--no-acl',
                      '--file', str(output / 'database.dump')], args.pg_bin, env)
    # All writers remain stopped until both DB and files are captured.
    count = 0
    with tarfile.open(output / 'photos.tar.gz', 'w:gz') as tar:
        for path in sorted(photos.rglob('*')):
            if path.is_symlink() or getattr(path, 'is_junction', lambda: False)():
                raise ValueError('Photo source contains a link; backup refused.')
            if path.is_file():
                tar.add(path, arcname=path.relative_to(photos).as_posix(), recursive=False)
                count += 1
    metadata = {
        'formatVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
        'environment': args.environment, 'sourceDatabase': env['PGDATABASE'],
        'writersStopped': True, 'photoFiles': count,
        'postgresVersion': run_pg('pg_dump', ['--version'], args.pg_bin, env),
    }
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    manifest = {name: sha256(output / name) for name in FILES}
    # This final file is the completion marker. A folder without it is incomplete.
    (output / 'sha256.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    verify_bundle(output)
    print(f'Backup verified: {output}; {count} photo files. Writers may now resume.')


def restore(args) -> None:
    if not re.fullmatch(r'[a-z][a-z0-9_]{2,62}', args.target_database):
        raise ValueError('Target database must be a new lowercase identifier, 3-63 characters.')
    bundle = args.bundle.resolve(strict=True)
    metadata = verify_bundle(bundle)
    if args.target_database == metadata['sourceDatabase']:
        raise ValueError('Restore target must differ from the source database.')
    photos = args.target_photos.resolve()
    if photos.exists() or args.target_photos.is_symlink():
        raise FileExistsError('Target photo directory must not exist; restore never overwrites files.')
    marker = photos.parent / (photos.name + '-restore.json')
    if marker.exists() or marker.is_symlink():
        raise FileExistsError('Restore metadata target already exists; choose a new photo destination.')
    env = connection_env()
    env['PGDATABASE'] = 'postgres'
    exists = run_pg('psql', ['-X', '-tA', '-v', 'ON_ERROR_STOP=1', '-c',
                    f"SELECT 1 FROM pg_database WHERE datname = '{args.target_database}'"], args.pg_bin, env)
    if exists:
        raise FileExistsError('Target database already exists; restore never drops or cleans databases.')
    run_pg('createdb', ['--template=template0', args.target_database], args.pg_bin, env)
    env['PGDATABASE'] = args.target_database
    # A failed restore is left isolated for diagnosis; there is no destructive cleanup.
    run_pg('pg_restore', ['--dbname', args.target_database, '--exit-on-error', '--single-transaction',
                         '--no-owner', '--no-acl', str(bundle / 'database.dump')], args.pg_bin, env)
    photos.mkdir(parents=True, mode=0o700)
    with tarfile.open(bundle / 'photos.tar.gz', 'r:gz') as tar:
        for member in tar.getmembers():
            target = photos.joinpath(*PurePosixPath(member.name).parts)
            if not target.resolve().is_relative_to(photos):
                raise ValueError('Photo path escaped restore target.')
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as source, target.open('xb') as destination:
                    shutil.copyfileobj(source, destination)
    # Keep operational metadata outside the photo object namespace, without overwriting a sibling file.
    with marker.open('x', encoding='utf-8') as stream:
        json.dump({'environment': args.environment, 'database': args.target_database,
                   'restoredAt': datetime.now(timezone.utc).isoformat(), 'sourceBundle': str(bundle)}, stream, indent=2)
        stream.write('\n')
    print(f'Restored into NEW database {args.target_database} and NEW photo directory {photos}. Validate before use.')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    source = commands.add_parser('backup')
    source.add_argument('--photos', type=Path, required=True)
    source.add_argument('--output', type=Path, required=True)
    source.add_argument('--writers-stopped', action='store_true')
    source.set_defaults(action=backup)
    target = commands.add_parser('restore')
    target.add_argument('--bundle', type=Path, required=True)
    target.add_argument('--target-database', required=True)
    target.add_argument('--target-photos', type=Path, required=True)
    target.set_defaults(action=restore)
    for command in (source, target):
        command.add_argument('--pg-bin')
        command.add_argument('--environment', choices=['Development', 'Test', 'RestoreValidation'], required=True)
    args = parser.parse_args()
    try:
        args.action(args)
    except (ValueError, FileExistsError, FileNotFoundError, RuntimeError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
