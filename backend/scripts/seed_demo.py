"""POST a generated demo galaxy to a running Stellardeps backend."""

import argparse

import requests

from stellardeps.seed import generate_demo_graph


def main() -> None:
    """Generate the demo graph and import it via the API."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="backend base URL")
    parser.add_argument("--nodes", type=int, default=2000, help="total node count")
    parser.add_argument("--packs", type=int, default=15, help="number of packs")
    args = parser.parse_args()
    payload = generate_demo_graph(node_count=args.nodes, pack_count=args.packs)
    response = requests.post(f"{args.url}/import", json=payload.model_dump(), timeout=60)
    response.raise_for_status()
    print(f"imported: {response.json()}")


if __name__ == "__main__":
    main()
