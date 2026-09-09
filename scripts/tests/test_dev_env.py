import importlib.util
from pathlib import Path
import tempfile
import unittest


MODULE = Path(__file__).parents[1] / 'generate_dev_env.py'
spec = importlib.util.spec_from_file_location('generate_dev_env', MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DevEnvironmentTests(unittest.TestCase):
    def test_generates_distinct_secrets_and_private_credentials_file(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            module.generate(Path(first))
            module.generate(Path(second))
            text = (Path(first) / '.env').read_text()
            values = dict(line.split('=', 1) for line in text.splitlines() if line and not line.startswith('#'))
            self.assertGreaterEqual(len(values['JWT_SIGNING_KEY']), 64)
            self.assertGreaterEqual(len(values['POSTGRES_PASSWORD']), 32)
            self.assertNotEqual(values['POSTGRES_PASSWORD'], values['DEV_ADMIN_PASSWORD'])
            self.assertNotEqual(text, (Path(second) / '.env').read_text())
            self.assertTrue((Path(first) / '.local' / 'dev-credentials.json').is_file())

    def test_existing_env_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.env').write_text('KEEP=existing\n')
            with self.assertRaises(FileExistsError):
                module.generate(root)
            self.assertEqual((root / '.env').read_text(), 'KEEP=existing\n')
            self.assertFalse((root / '.local' / 'dev-credentials.json').exists())

    def test_existing_credentials_prevent_partial_env_creation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.local').mkdir()
            credentials = root / '.local' / 'dev-credentials.json'
            credentials.write_text('existing')
            with self.assertRaises(FileExistsError):
                module.generate(root)
            self.assertFalse((root / '.env').exists())
            self.assertEqual(credentials.read_text(), 'existing')


if __name__ == '__main__':
    unittest.main()
