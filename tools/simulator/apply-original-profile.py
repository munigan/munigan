"""Apply narrowly checked Original-profile hooks to the pinned engine checkout."""
import json
import pathlib
import shutil
import subprocess

ROOT=pathlib.Path(__file__).resolve().parents[2]
ENGINE=ROOT/'.cache/wotlk'
PIN='563e4a08cb15729f1fdcbcf68e6d68224553bfef'

def patch(path,replacements):
    source=subprocess.check_output(['git','-C',str(ENGINE),'show',f'{PIN}:{path}'],text=True)
    for old,new,count in replacements:
        actual=source.count(old)
        if actual!=count: raise ValueError(f'{path}: expected {count} occurrences, found {actual}: {old}')
        source=source.replace(old,new)
    (ENGINE/path).write_text(source)

patch('sim/common/wotlk/stat_bonus_procs.go',[
 ('procAura := character.NewTemporaryStatsAura(config.Name+" Proc", procID, config.Bonus, config.Duration)',
  'procAura := character.NewTemporaryStatsAura(config.Name+" Proc", procID, core.ItemVersionStats(config.ID, config.Bonus), config.Duration)',1)])
patch('sim/common/wotlk/stat_bonus_stacking.go',[
 ('BonusPerStack: config.Bonus,','BonusPerStack: core.ItemVersionStats(config.ID, config.Bonus),',2)])
patch('sim/core/major_cooldown.go',[
 ('RegisterTemporaryStatsOnUseCD(character, auraLabel, tempStats, duration, localConfig)',
  'RegisterTemporaryStatsOnUseCD(character, auraLabel, ItemVersionStats(config.ActionID.ItemID, tempStats), duration, localConfig)',1)])
patch('sim/core/mana.go',[
 ('baseCost = max(0, baseCost-44)','baseCost = max(0, baseCost-ItemVersionScalar(45703, 44))',1)])
patch('sim/deathknight/items.go',[
 ('core.TernaryFloat64(dk.Ranged().ID == 45254, 403, 0)','core.TernaryFloat64(dk.Ranged().ID == 45254, core.ItemVersionScalar(45254, 403), 0)',1),
 ('core.TernaryFloat64(dk.Ranged().ID == 45254, 218, 0)','core.TernaryFloat64(dk.Ranged().ID == 45254, core.ItemVersionFrostStrikeBonus(218), 0)',1),
 ('stats.Stats{stats.Dodge: 144.0}, time.Second*5','core.ItemVersionStats(45144, stats.Stats{stats.Dodge: 144.0}), time.Second*5',1)])
patch('sim/druid/insect_swarm.go',[
 ('core.TernaryFloat64(druid.Ranged().ID == CryingWind, 396, 0)','core.TernaryFloat64(druid.Ranged().ID == CryingWind, core.ItemVersionScalar(45270, 396), 0)',1)])
patch('sim/druid/items.go',[
 ('stats.Stats{stats.Agility: 162}, time.Second*12','core.ItemVersionStats(45509, stats.Stats{stats.Agility: 162}), time.Second*12',1),
 ('stats.Stats{stats.AttackPower: atkPwr}, time.Second*time.Duration(numSeconds)','core.ItemVersionStats(itemId, stats.Stats{stats.AttackPower: atkPwr}), time.Second*time.Duration(numSeconds)',1)])
patch('sim/shaman/heals.go',[
 ('core.TernaryFloat64(shaman.Ranged().ID == 42598, 338, 0)','core.TernaryFloat64(shaman.Ranged().ID == 42598, core.ItemVersionScalar(42598, 338), 0)',2),
 ('core.TernaryFloat64(shaman.Ranged().ID == 45114, 257, 0)','core.TernaryFloat64(shaman.Ranged().ID == 45114, core.ItemVersionScalar(45114, 257), 0)',1)])
patch('sim/paladin/items.go',[
 ('stats.Stats{stats.BlockValue: 450}, time.Second*20','core.ItemVersionStats(45145, stats.Stats{stats.BlockValue: 450}), time.Second*20',1)])

catalog=json.loads((ROOT/'data/wotlk/original-items.json').read_text())
audit=json.loads((ROOT/'data/wotlk/original-items-audit.json').read_text())
fields={'id','name','type','armorType','weaponType','handType','rangedWeaponType','stats','gemSockets','socketBonus','weaponDamageMin','weaponDamageMax','weaponSpeed','setName'}
profile={'items':[{k:v for k,v in item.items() if k in fields} for item in catalog['items']],'unsupportedItemIds':catalog['unsupportedItemIds'],'mechanics':audit['mechanics']}
(ENGINE/'sim/core/original-item-profile.json').write_text(json.dumps(profile,separators=(',',':'))+'\n')
for path in (ROOT/'tools/simulator/core-overlay').glob('*.go'): shutil.copyfile(path,ENGINE/'sim/core'/path.name)
print('Applied trusted Original item profile:',catalog['revision'])
