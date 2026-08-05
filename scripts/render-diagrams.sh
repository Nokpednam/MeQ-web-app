#!/usr/bin/env bash
set -euo pipefail
mkdir -p docs/diagrams/rendered
for file in docs/diagrams/*.mmd; do
  name="$(basename "$file" .mmd)"
  npx --yes @mermaid-js/mermaid-cli -i "$file" -o "docs/diagrams/rendered/$name.svg" -b transparent
  echo "Rendered $name.svg"
done
