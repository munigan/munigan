"""Source-backed regression cases for the Original WotLK item catalog."""
import json
import pathlib
import unittest
import importlib.util

ROOT = pathlib.Path(__file__).resolve().parents[2]

class OriginalItemsTests(unittest.TestCase):
    def test_original_dataset_is_available(self):
        self.assertTrue((ROOT / 'data/wotlk/original-items.json').exists(), 'Original item data must be generated')

    def test_mjolnir_stats_and_proc(self):
        path = ROOT / 'data/wotlk/original-items.json'
        data = json.loads(path.read_text())
        item = next(item for item in data['items'] if item['id'] == 45931)
        self.assertEqual(item['ilvl'], 226)
        self.assertEqual(item['stats'][13], 102)
        self.assertEqual(item['stats'][8], 102)
        self.assertIn('665', ' '.join(data['effects']['45931']))
        self.assertNotIn(45931, data['unsupportedItemIds'])

    def test_original_weapon_sockets_armor_and_passive_spells(self):
        items = {item['id']: item for item in json.loads((ROOT / 'data/wotlk/original-items.json').read_text())['items']}
        sword = items[45516]
        self.assertEqual((sword['ilvl'], sword['weaponDamageMin'], sword['weaponDamageMax'], sword['weaponSpeed']), (239, 704, 1057, 3.6))
        self.assertEqual(sword['gemSockets'], [2, 3])
        self.assertEqual((sword['socketBonus'][8], sword['socketBonus'][13]), (6, 6))
        self.assertEqual((items[45267]['stats'][20], items[45267]['stats'][34]), (2054, 826))
        self.assertEqual((items[45112]['stats'][20], items[45112]['stats'][34]), (0, 448))
        self.assertEqual((items[45682]['stats'][20], items[45682]['stats'][34], items[45682]['stats'][24]), (7802, 0, 218))
        self.assertEqual(items[45139]['stats'][24], 135)
        self.assertEqual(items[40807]['ilvl'], 232)

    def test_effect_audit_has_original_source_values_and_fail_closed_coverage(self):
        data = json.loads((ROOT / 'data/wotlk/original-items.json').read_text())
        audit = json.loads((ROOT / 'data/wotlk/original-items-audit.json').read_text())
        self.assertEqual(audit['coverage']['upgradedItems'], 878)
        for item_id, amount in [('45931', 665), ('45518', 850), ('45609', 726), ('45466', 432), ('45308', 25), ('46051', 75), ('45254', 380), ('45270', 374), ('45703', 42)]:
            self.assertEqual(audit['mechanics'][item_id]['original'], amount)
        self.assertIn(46312, data['unsupportedItemIds'])
        self.assertIn(211817, data['unsupportedItemIds'])
        self.assertNotIn(45170, data['unsupportedItemIds'])  # Original wand damage is preserved.
        self.assertEqual(set(map(str, data['unsupportedItemIds'])), set(audit['unsupportedReasons']))
        # Naxxramas, ToC and ICC items are deliberately unchanged baseline entries.
        self.assertFalse({40256, 47069, 50730} & {item['id'] for item in data['items']})
        self.assertEqual(data['revision'], audit['revision'])
        for source in data['sources'].values():
            self.assertEqual(len(source['sha256']), 64)
            self.assertIn(source['commit'], source['url'])

    def test_unknown_stat_mapping_fails_closed(self):
        spec = importlib.util.spec_from_file_location('original_items', ROOT / 'tools/data/original-items.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with self.assertRaisesRegex(ValueError, 'Unmapped original stat type'):
            module.add_stat([0] * 40, 999, 12)

if __name__ == '__main__':
    unittest.main()
