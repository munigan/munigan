"""Extract meta activation rules from the pinned simulator checkout."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
lock = json.loads((root / "tools/simulator/source.lock.json").read_text())
source = "ui/core/proto_utils/gems.ts"
text = (root / ".cache/wotlk" / source).read_text()
conditions = {}
for item_id, description, red, yellow, blue in re.findall(
    r"MetaGemCondition.fromMinColors\((\d+), '([^']+)', (\d+), (\d+), (\d+)\)", text
):
    conditions[item_id] = {
        "description": description,
        "minimum": [int(red), int(yellow), int(blue)],
    }
for item_id, description, greater, lesser in re.findall(
    r"MetaGemCondition.fromCompareColors\((\d+), '([^']+)', GemColor.GemColor(\w+), GemColor.GemColor(\w+)\)", text
):
    conditions[item_id] = {
        "description": description,
        "minimum": [0, 0, 0],
        "greater": ["Red", "Yellow", "Blue"].index(greater),
        "lesser": ["Red", "Yellow", "Blue"].index(lesser),
    }
if not conditions:
    raise RuntimeError("No meta rules found in the simulator source")
(root / "data/wotlk/meta-gem-conditions.json").write_text(
    json.dumps({
        "source": f"Poli93/wotlk@{lock['commit']} {source}",
        "conditions": conditions,
    }, indent=2) + "\n"
)
print(f"Extracted {len(conditions)} meta activation rules")
