"""Import the dynamic dependencies of a local binary (via `ldd`) into Stellardeps."""

import argparse

import requests

from stellardeps.ldd import ldd_payload


def main() -> None:
    """Run ldd on a binary and import the resulting graph via the API."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binary", help="path to a dynamically linked executable")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="backend base URL")
    args = parser.parse_args()
    payload = ldd_payload(args.binary)
    response = requests.post(f"{args.url}/import", json=payload.model_dump(), timeout=30)
    response.raise_for_status()
    print(f"imported: {response.json()}")


if __name__ == "__main__":
    main()
