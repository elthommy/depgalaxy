"""Import the dynamic dependencies of a local binary (via `ldd`) into Stellardeps."""

import argparse
import subprocess
from pathlib import Path

import requests

from stellardeps.ldd import parse_ldd


def main() -> None:
    """Run ldd on a binary and import the resulting graph via the API."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binary", help="path to a dynamically linked executable")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="backend base URL")
    args = parser.parse_args()
    result = subprocess.run(["ldd", args.binary], capture_output=True, text=True, check=True)
    payload = parse_ldd(result.stdout, root=Path(args.binary).name)
    response = requests.post(f"{args.url}/import", json=payload.model_dump(), timeout=30)
    response.raise_for_status()
    print(f"imported: {response.json()}")


if __name__ == "__main__":
    main()
