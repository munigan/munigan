"""Extract plain-text gem bonuses from the pinned simulator's Wowhead data."""
import html
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
gems = json.loads((root / "data/wotlk/db.json").read_text())["gems"]
gem_ids = {gem["id"] for gem in gems}
descriptions = {}
source = root / ".cache/wotlk/assets/db_inputs/wowhead_item_tooltips.csv"
for line in source.read_text().splitlines():
    item_id, raw = line.split(",", 1)
    if int(item_id) not in gem_ids:
        continue
    tooltip = json.loads(raw)["tooltip"]
    match = re.search(r'<span class="q1">(.*?)</span>', tooltip)
    if match:
        descriptions[item_id] = html.unescape(re.sub(r"<[^>]+>", "", match[1]))

# The only missing entry is an unsupported meta gem; never silently omit a usable gem.
missing = gem_ids - {int(key) for key in descriptions}
assert missing == {33633}, f"Unexpected missing gem descriptions: {missing}"
output = {
    "source": "Poli93/wotlk@563e4a08cb15729f1fdcbcf68e6d68224553bfef assets/db_inputs/wowhead_item_tooltips.csv",
    "descriptions": dict(sorted(descriptions.items(), key=lambda item: int(item[0]))),
}
(root / "data/wotlk/gem-descriptions.json").write_text(json.dumps(output, indent=2) + "\n")
