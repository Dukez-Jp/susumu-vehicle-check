import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('backup_restore', Path(__file__).parents[1] / 'backup_restore.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupSafetyTests(unittest.TestCase):
    def test_backup_requires_explicit_writer_quiescence(self):
        with self.assertRaisesRegex(ValueError, 'Stop all'):
            module.backup(SimpleNamespace(writers_stopped=False))

    def test_archive_refuses_path_traversal_and_links(self):
        for name, kind in [('../escape', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE),
                           ('C:\\escape', tarfile.REGTYPE), ('link', tarfile.SYMTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                archive = Path(folder) / 'photos.tar.gz'
                with tarfile.open(archive, 'w:gz') as tar:
                    member = tarfile.TarInfo(name)
                    member.type = kind
                    tar.addfile(member, io.BytesIO())
                with self.assertRaises(ValueError):
                    module.validate_archive(archive)

    def test_corrupted_dump_fails_before_database_access(self):
        with tempfile.TemporaryDirectory() as folder:
            bundle = Path(folder)
            for name in module.FILES:
                (bundle / name).write_bytes(b'original')
            manifest = {name: module.sha256(bundle / name) for name in module.FILES}
            (bundle / 'sha256.json').write_text(json.dumps(manifest))
            (bundle / 'database.dump').write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                module.verify_bundle(bundle)

    def test_restore_refuses_sql_identifier_injection(self):
        with self.assertRaisesRegex(ValueError, 'lowercase identifier'):
            module.restore(SimpleNamespace(target_database="name'; DROP DATABASE existing; --"))


if __name__ == '__main__':
    unittest.main()
