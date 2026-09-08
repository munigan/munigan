#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
project_root="$PWD"
source_dir="$project_root/.cache/wotlk"
engine_pin=563e4a08cb15729f1fdcbcf68e6d68224553bfef
if [ ! -d "$source_dir/.git" ]; then
 git clone --filter=blob:none --no-checkout https://github.com/Poli93/wotlk.git "$source_dir"
 git -C "$source_dir" checkout "$engine_pin"
fi
[ "$(git -C "$source_dir" rev-parse HEAD)" = "$engine_pin" ]
export GOTOOLCHAIN=go1.23.4
mkdir -p .cache/tools src/generated/wotlk "$source_dir/sim/core/proto" "$source_dir/ui/core/proto" dist/simulator/local
GOBIN="$project_root/.cache/tools" go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6
export PATH="$project_root/.cache/tools:$PATH"
pnpm exec protoc -I "$source_dir/proto" --ts_out src/generated/wotlk "$source_dir"/proto/*.proto
node --input-type=module -e 'import fs from "node:fs"; for (const file of fs.readdirSync("src/generated/wotlk")) { if (!file.endsWith(".ts")) continue; const path = `src/generated/wotlk/${file}`; fs.writeFileSync(path, fs.readFileSync(path, "utf8").replace(/[ \t]+$/gm, "")); }'
pnpm exec protoc -I "$source_dir/proto" --go_out "$source_dir/sim/core" "$source_dir"/proto/*.proto
cp src/generated/wotlk/*.ts "$source_dir/ui/core/proto/"
cp tools/simulator/overlay/*.go "$source_dir/cmd/wowsimcli/cmd/"
cd "$source_dir"
go test -tags=with_db ./cmd/wowsimcli/cmd -run TestEvaluateJSON -count=1
CGO_ENABLED=0 go build -tags=with_db -o "$project_root/dist/simulator/local/wowsimcli" ./cmd/wowsimcli
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags=with_db -o "$project_root/dist/simulator/wowsimcli" ./cmd/wowsimcli
cd "$project_root"
shasum -a 256 dist/simulator/wowsimcli dist/simulator/local/wowsimcli > dist/simulator/SHA256SUMS
