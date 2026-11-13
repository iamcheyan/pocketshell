import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class DeploymentCheckTest(unittest.TestCase):
    def test_mock_adb_stages_and_checks_real_package_and_runtime(self):
        repo = Path(__file__).resolve().parents[1]
        pjos = repo.parent / "PJOS-LINUX"
        runtime = pjos / "work/pocketjs-runtime/pocket-linux-kms"
        package = repo / "dist/pocketshell.pocket"
        if not runtime.exists() or not package.exists():
            self.skipTest("built runtime and package are required")
        with tempfile.TemporaryDirectory() as temp:
            fake_adb = Path(temp) / "adb"
            fake_adb.write_text('''#!/usr/bin/env python3
import os, shutil, subprocess, sys
args = sys.argv[1:]
if args == ["devices"]:
    print("List of devices attached\\nfixture\\tdevice\\n")
elif args[:2] == ["-s", "fixture"] and args[2:] == ["get-state"]:
    print("device")
elif args[:3] == ["-s", "fixture", "push"]:
    shutil.copyfile(args[3], args[4])
elif args[:3] == ["-s", "fixture", "shell"]:
    command = args[3].replace("hostname; id", "printf 'rg34xx\\\\nuid=0(root)\\\\n'", 1)
    command = command.replace("./pocket-linux-kms --package", "qemu-aarch64 ./pocket-linux-kms --package")
    subprocess.run(["sh", "-c", command], check=False)
else:
    sys.exit(2)
''')
            fake_adb.chmod(0o755)
            env = {**os.environ, "PATH": temp + os.pathsep + os.environ["PATH"], "PJOS_ADB_SERIAL": "fixture"}
            result = subprocess.run(["bash", str(repo / "scripts/deploy-rg34xx.sh"), "--check"], env=env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("Runtime and package admitted", result.stdout)


if __name__ == "__main__":
    unittest.main()
