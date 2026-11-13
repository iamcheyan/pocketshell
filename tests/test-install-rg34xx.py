import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/install-rg34xx.sh"
FILES = {
    "boot.pocket": "pocketjs/apps/boot.pocket",
    "pocket-linux-kms": "pocketjs/bin/launcher/pocket-linux-kms",
    "pocketshell-games": "compat/bin/pocketshell-games",
    "pocketshell-play": "compat/bin/pocketshell-play",
    "pocket-game-play": "compat/bin/pocket-game-play",
    "pocketjs-native-launch": "compat/bin/pocketjs-native-launch",
    "launch_frontend.sh": "launch_frontend.sh",
}


class InstallerTest(unittest.TestCase):
    def fixture(self, temp, fail_second=False):
        root = Path(temp) / "System"
        stage = Path(temp) / "stage"
        stage.mkdir()
        for relative in FILES.values():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("old:" + relative)
        legacy = root / "pocketjs/bin/pocket-linux-kms"
        legacy.write_text("legacy runtime")
        for name in FILES:
            (stage / name).write_text("new:" + name)
        runtime = stage / "pocket-linux-kms"
        runtime.write_text('''#!/bin/sh
count=0
[ ! -f "$TEST_COUNTER" ] || read -r count < "$TEST_COUNTER"
count=$((count + 1))
printf '%s' "$count" > "$TEST_COUNTER"
[ "${TEST_FAIL_SECOND:-0}" != 1 ] || [ "$count" -lt 2 ]
''')
        names = list(FILES)
        (stage / "SHA256SUMS").write_text("".join(f'{hashlib.sha256((stage / name).read_bytes()).hexdigest()}  {name}\n' for name in names))
        env = {**os.environ, "PJOS_DEPLOY_ROOT": str(root), "TEST_COUNTER": str(Path(temp) / "counter"), "TEST_FAIL_SECOND": "1" if fail_second else "0"}
        return root, stage, legacy, env

    def test_install_preserves_legacy_runtime_and_backs_up_replaced_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root, stage, legacy, env = self.fixture(temp)
            subprocess.run(["sh", str(SCRIPT), str(stage)], env=env, check=True, capture_output=True)
            self.assertEqual(legacy.read_text(), "legacy runtime")
            self.assertEqual((root / FILES["boot.pocket"]).read_text(), "new:boot.pocket")
            backups = list((root / "pocketjs/backups").iterdir())
            self.assertEqual(len(backups), 1)
            self.assertEqual((backups[0] / FILES["boot.pocket"]).read_text(), "old:" + FILES["boot.pocket"])

    def test_failed_final_admission_restores_every_existing_file(self):
        with tempfile.TemporaryDirectory() as temp:
            root, stage, legacy, env = self.fixture(temp, fail_second=True)
            result = subprocess.run(["sh", str(SCRIPT), str(stage)], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            for relative in FILES.values():
                self.assertEqual((root / relative).read_text(), "old:" + relative)
            self.assertEqual(legacy.read_text(), "legacy runtime")

    def test_failed_admission_removes_new_files_that_had_no_backup(self):
        with tempfile.TemporaryDirectory() as temp:
            root, stage, legacy, env = self.fixture(temp, fail_second=True)
            new_runtime = root / FILES["pocket-linux-kms"]
            new_runtime.unlink()
            result = subprocess.run(["sh", str(SCRIPT), str(stage)], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(new_runtime.exists())
            self.assertEqual(legacy.read_text(), "legacy runtime")

    def test_refuses_symlink_destination(self):
        with tempfile.TemporaryDirectory() as temp:
            root, stage, legacy, env = self.fixture(temp)
            package = root / FILES["boot.pocket"]
            package.unlink()
            package.symlink_to(legacy)
            result = subprocess.run(["sh", str(SCRIPT), str(stage)], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(legacy.read_text(), "legacy runtime")
            self.assertTrue(package.is_symlink())

    def test_adb_remote_reports_device_failure_even_if_adb_returns_success(self):
        source = (SCRIPT.parent / "deploy-rg34xx.sh").read_text()
        remote = source[source.index("remote() {"):source.index("\npush() {")]
        shell = '''
transport=adb
serial=fake
adb() { shift 3; sh -c "$1"; return 0; }
''' + remote + '''
if remote 'false'; then exit 1; fi
result=$(remote 'printf value') || exit 1
[ "$result" = value ]
'''
        subprocess.run(["bash", "-c", shell], check=True, capture_output=True)


if __name__ == "__main__":
    unittest.main()
