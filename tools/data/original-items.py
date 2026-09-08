"""Generate trusted Original 3.3.5 item overrides from pinned, hash-checked SQL.

SQL is parsed as data and never executed. Only Classic-upgraded items are replaced;
unchanged entries continue to use the pinned simulator baseline. A spell audit is
required for every upgraded item's non-passive effect, with unknowns excluded.
"""
import argparse
import copy
import hashlib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
REVISION = 'original-335-v1'
DBC_PIN = 'ef28c4205b329e11cc1327e8d817dbfa967a6797'
SOURCES = {
    'item_template': ('azerothcore/azerothcore-wotlk', 'db533ad7537a0641d076b13e5611f29f33558d06', 'data/sql/base/db_world/item_template.sql', 'bd4859be01946ca1521f7896f558f665e1e1d98890757a3df30e717b62768cc6'),
    'Spell': ('Kaev/AzerothcoreDBCToSQL', DBC_PIN, 'Spell.sql', '4b1d4dad432be85099ad7b4de35f082820da59892fdf49fee9afc47162b0ecc6'),
    'SpellItemEnchantment': ('Kaev/AzerothcoreDBCToSQL', DBC_PIN, 'SpellItemEnchantment.sql', 'b3e0756888569f1d4016c698d1a10361636d8e506b7282fafc9eebc9dc061f36'),
    'SpellDuration': ('Kaev/AzerothcoreDBCToSQL', DBC_PIN, 'SpellDuration.sql', '0a651a0dc62b7d4a67295edb511ca719f2210e2916d3f98691890487b8c57467'),
}
# ItemModType -> simulator Stat enum. Unified ratings and AP affect both channels.
STAT_MAP = {0:(17,),1:(28,),3:(1,),4:(0,),5:(3,),6:(4,),7:(2,),12:(22,),13:(25,),14:(26,),15:(23,),16:(12,),17:(12,),18:(7,),19:(13,),20:(13,),21:(8,),28:(14,),29:(14,),30:(9,),31:(7,12),32:(8,13),35:(27,),36:(9,14),37:(16,),38:(11,21),39:(21,),43:(6,),44:(15,),45:(5,),47:(10,),48:(24,)}
SOCKET_MAP = {1:1,2:2,4:4,8:3,14:8}
# Each scalar is read directly from the indicated original spell effect. Multiple
# consumers may use one scalar (e.g. melee and ranged AP). Durations/conditions
# stay in the pinned simulator; original and Classic share these implementations.
# item: (spell, effect, classic scalar, native stat indexes or None, kind, description)
EFFECTS = {
 42598:(60559,1,338,None,'scalar','Increases Lesser Healing Wave spell power by {value}.'),
 45114:(64960,1,257,None,'scalar','Increases the base healing of Chain Heal by {value}.'),
 45286:(65014,1,1305,[11,21],'proc','Melee and ranged critical strikes can grant {value} attack power for 10 seconds.'),
 45490:(64741,1,794,[5],'proc','Spells can grant {value} spell power for 10 seconds.'),
 45522:(64790,1,1358,[11,21],'proc','Melee and ranged critical strikes can grant {value} attack power for 10 seconds.'),
 45518:(64713,1,959,[5],'proc','Harmful spells can grant {value} spell power for 10 seconds.'),
 45535:(64739,1,272,[6],'proc','Spell casts can grant {value} mana per 5 seconds for 15 seconds.'),
 45609:(64772,1,819,[9,14],'proc','Melee and ranged attacks can grant {value} haste rating for 10 seconds.'),
 45866:(65004,1,552,[9,14],'proc','Harmful spells can grant {value} haste rating for 10 seconds.'),
 45929:(65003,1,220,[6],'proc','Spell casts can grant {value} mana per 5 seconds for 15 seconds.'),
 45931:(65019,1,751,[15],'proc','Melee and ranged attacks can grant {value} armor penetration rating for 10 seconds.'),
 46038:(65024,1,692,[8,13],'proc','Melee and ranged attacks can grant {value} critical strike rating for 10 seconds.'),
 45466:(64707,1,457,[9,14],'active','Use: Grants {value} haste rating for 20 seconds. 2 minute cooldown.'),
 45263:(64800,1,905,[11,21],'active','Use: Grants {value} attack power for 20 seconds. 2 minute cooldown.'),
 45148:(64712,1,534,[5],'active','Use: Grants {value} spell power for 20 seconds. 2 minute cooldown.'),
 45292:(65008,1,431,[5],'active','Use: Grants {value} spell power for 20 seconds. 2 minute cooldown.'),
 45313:(65011,1,5448,[20],'active','Use: Grants {value} armor for 20 seconds. 2 minute cooldown.'),
 45158:(64763,1,457,[25],'active','Use: Grants {value} dodge rating for 20 seconds. 2 minute cooldown.'),
 46021:(65012,1,402,[26],'active','Use: Grants {value} parry rating for 20 seconds. 2 minute cooldown.'),
 45308:(65006,1,26,[5],'stacking','Damaging and healing spells grant {value} spell power for 10 seconds, stacking up to 5 times.'),
 46051:(65000,1,85,[6],'stacking-active','Use: Spell casts grant a stacking {value} mana per 5 seconds bonus during a 20 second effect, up to 20 stacks. 2 minute cooldown.'),
 45509:(64951,1,162,[1],'relic','Mangle can grant {value} agility for 12 seconds.'),
 42589:(60551,1,152,[11,21],'relic','Mangle grants {value} attack power for 10 seconds.'),
 45270:(64950,1,396,None,'scalar','Increases the spell power of Insect Swarm by {value}.'),
 45254:(64962,2,403,None,'scalar','Increases Death Coil damage by {value} and Frost Strike damage by 113.'),
 45703:(65010,1,44,None,'scalar','Reduces the base mana cost of spells by {value}.'),
 45144:(64963,1,144,[25],'relic','Rune Strike grants {value} dodge rating for 5 seconds.'),
 45145:(65182,1,450,[24],'relic','Holy Shield grants {value} block value for 20 seconds.'),
}
# Source effects that the pinned engine already represents with their original
# amounts, or which have no effect on the supported DPS simulation (travel/PvP CC).
UNCHANGED_SPELLS = {
 22778:'Hamstring cost reduction; unchanged PvP glove effect',44300:'Crusader Strike damage percentage; unchanged glove effect',62459:'Chains of Ice runic power; unchanged glove effect',38522:'Flash of Light critical chance; unchanged glove effect',32973:'Shock and Wind Shear range; unchanged glove effect',61255:'Tranquilizing Shot cooldown; unchanged glove effect',33830:'Cyclone cast time; unchanged glove effect',61249:'Kick cost; unchanged glove effect',61252:'Maim cost; unchanged glove effect',44297:'Psychic Scream cooldown; unchanged glove effect',44301:'Polymorph pushback; unchanged glove effect',33063:'Fear pushback; unchanged glove effect',
 60573:'Furious shaman spell-power proc remains 84',60550:'Furious shaman Lava Lash AP proc remains 144',60687:'Furious DK Plague Strike AP proc remains 144',60634:'Furious paladin Crusader Strike AP proc remains 144',
 64959:'Stormstrike flat damage remains 155',64961:'Lava Burst damage remains 215',64957:'Divine Storm damage remains 235',64764:'Damage reduction remains 205 for 10 seconds',54406:'Dalaran teleport has no combat stat effect',
}
# Healing relics without an implemented native effect and unsourced extra spells
# are deliberately unavailable in Original until independently implemented.
UNSUPPORTED_SPELLS = {60739:'Lifebloom relic effect is not implemented',60722:'Moonfire PvP relic effect is not implemented',60559:'Healing relic effect requires a separate native audit',60661:'Flash of Light relic effect is not implemented',64960:'Chain Heal relic effect requires a separate native audit',64956:'Holy Light relic effect is not implemented',64949:'Nourish relic effect is not implemented',64415:'Valanyr has an additional item spell missing from pinned original DBC',68496:'Item spell is missing from pinned original DBC',64981:'Tentacle summon is not implemented by the native engine'}

def records(sql):
    """Parse SQL value tuples; quotes/escapes remain data, never executable SQL."""
    for match in re.finditer(r'INSERT INTO `[^`]+` VALUES\s+', sql):
        i=match.end(); row=[]; token=''; quoted=None; inside=False
        while i<len(sql):
            c=sql[i]; i+=1
            if quoted:
                if c=='\\':
                    if i>=len(sql): raise ValueError('Truncated SQL escape')
                    token+=sql[i]; i+=1
                elif c==quoted: quoted=None
                else: token+=c
            elif c in "'\"": quoted=c
            elif c=='(': inside=True; row=[]; token=''
            elif c==',' and inside: row.append(token); token=''
            elif c==')': row.append(token); yield row; inside=False; token=''
            elif c==';': break
            elif inside: token+=c

def source_text(name):
    repo,pin,path,digest=SOURCES[name]
    cache=ROOT/'.cache'/f'{name}.sql'
    if not cache.exists():
        cache.parent.mkdir(parents=True,exist_ok=True)
        urllib.request.urlretrieve(f'https://raw.githubusercontent.com/{repo}/{pin}/{path}',cache)
    raw=cache.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=digest: raise ValueError(f'{name} checksum mismatch')
    return raw.decode()

def table(name, wanted=None):
    sql=source_text(name)
    header=sql[sql.index('CREATE TABLE'):sql.index('INSERT INTO')]
    columns=re.findall(r'`([^`]+)`\s+(?:tinyint|smallint|bigint|int|float|varchar|text|mediumint)',header,re.I)
    result={}
    # DBC exports have one INSERT per record; some unrelated tooltip records
    # contain broken SQL quoting. Parse only requested records and fail closed
    # if any requested record is malformed. Item templates have batched INSERTs.
    statements=re.split(r'(?=INSERT INTO `)',sql)[1:]
    for statement in statements:
        first_id=int(re.search(r'VALUES\s*\((\d+)',statement).group(1))
        if name!='item_template' and wanted is not None and first_id not in wanted: continue
        for row in records(statement):
            item_id=int(row[0])
            if wanted is not None and item_id not in wanted: continue
            if len(row)!=len(columns): raise ValueError(f'{name} {item_id}: {len(row)} values for {len(columns)} columns')
            result[item_id]=dict(zip(columns,row))
    return result

def add_stat(target,stat,value):
    if stat not in STAT_MAP: raise ValueError(f'Unmapped original stat type {stat}')
    for index in STAT_MAP[stat]: target[index]+=value

def spell_value(spell,effect):
    if float(spell[f'EffectRealPointsPerLevel_{effect}'])!=0 or int(spell[f'EffectDieSides_{effect}']) not in (0,1):
        raise ValueError(f'Spell {spell["ID"]}: variable/scaled effect needs explicit audit')
    return int(spell[f'EffectBasePoints_{effect}'])+int(spell[f'EffectDieSides_{effect}'])

def generate():
    baseline=json.loads((ROOT/'data/wotlk/db.json').read_text())['items']
    templates=table('item_template',{item['id'] for item in baseline})
    changed=[item for item in baseline if item['id'] in templates and item.get('ilvl',0)!=int(templates[item['id']]['ItemLevel'])]
    wanted_spells={int(templates[item['id']][f'spellid_{n}']) for item in changed for n in range(1,6)}|{value[0] for value in EFFECTS.values()}|{64962}
    spells=table('Spell',wanted_spells)
    enchantments=table('SpellItemEnchantment',{int(templates[item['id']]['socketBonus']) for item in changed})
    durations=table('SpellDuration',{int(spell['DurationIndex']) for spell in spells.values()})
    overrides=[]; audits=[]; effects={}; mechanics={}; unsupported={item['id']:'Missing original item template' for item in baseline if item['id'] not in templates}
    for item in changed:
        item_id=item['id']; source=templates[item_id]; original=copy.deepcopy(item); values=[0]*40
        original['ilvl']=int(source['ItemLevel'])
        for n in range(1,11):
            value=int(source[f'stat_value{n}'])
            if value: add_stat(values,int(source[f'stat_type{n}']),value)
        armor=int(source['armor']); bonus_armor=float(source['ArmorDamageModifier']) if int(source['class'])==4 else 0
        if item.get('type') in (2,11,12) or int(source['class'])==2: bonus_armor=armor # Neck/finger/trinket/weapon armor never scales as armor equipment.
        values[20]=armor-bonus_armor; values[34]=bonus_armor; values[24]+=int(source['block'])
        for field,index in [('arcane_res',29),('fire_res',30),('frost_res',31),('nature_res',32),('shadow_res',33)]:
            values[index]=int(source[field]) if source[field]!='NULL' else 0
        sockets=[SOCKET_MAP[int(source[f'socketColor_{n}'])] for n in range(1,4) if int(source[f'socketColor_{n}'])]
        original['gemSockets']=sockets
        socket_bonus=[0]*40; enchant_id=int(source['socketBonus'])
        if enchant_id:
            enchant=enchantments[enchant_id]
            for n in range(1,4):
                effect=int(enchant[f'Effect_{n}'])
                if effect==0: continue
                if effect!=5: raise ValueError(f'Unmapped socket effect {effect} on item {item_id}')
                add_stat(socket_bonus,int(enchant[f'EffectArg_{n}']),int(enchant[f'EffectPointsMin_{n}']))
        original['socketBonus']=socket_bonus
        if item.get('weaponSpeed',0):
            if (int(source['dmg_type1'])!=0 and item.get('rangedWeaponType')!=8) or float(source['dmg_min2'])!=0: unsupported[item_id]='Non-physical/multiple weapon damage components need audit'
            original['weaponDamageMin']=float(source['dmg_min1'])
            original['weaponDamageMax']=float(source['dmg_max1'])
            original['weaponSpeed']=int(source['delay'])/1000
        item_audit=[]
        for n in range(1,6):
            spell_id=int(source[f'spellid_{n}'])
            if spell_id<=0: continue
            spell=spells.get(spell_id)
            passive=False
            if spell:
                active=[j for j in range(1,4) if int(spell[f'Effect_{j}'])]
                if int(source[f'spelltrigger_{n}'])==1 and active and all(int(spell[f'Effect_{j}'])==6 and int(spell[f'EffectAura_{j}']) in (158,123) for j in active):
                    for j in active:
                        aura=int(spell[f'EffectAura_{j}']); values[24 if aura==158 else 10]+=abs(spell_value(spell,j))
                    passive=True
            if passive: status='Mapped passive block value/spell penetration from original spell'
            elif item_id in EFFECTS: status='Source-backed native effect override'
            elif spell_id in UNCHANGED_SPELLS: status=UNCHANGED_SPELLS[spell_id]
            else:
                status=UNSUPPORTED_SPELLS.get(spell_id,'Unaudited original effect')
                unsupported[item_id]=status
            item_audit.append({'spellId':spell_id,'status':status})
        original['stats']=values
        if int(source['ScalingStatDistribution']) or int(source['RandomProperty']) or int(source['RandomSuffix']): unsupported[item_id]='Dynamic/random item stats need audit'
        overrides.append(original)
        audits.append({'itemId':item_id,'name':item['name'],'classicIlvl':item['ilvl'],'originalIlvl':original['ilvl'],'changedFields':[key for key in ['ilvl','stats','socketBonus','gemSockets','weaponDamageMin','weaponDamageMax','weaponSpeed'] if original.get(key)!=item.get(key)],'spells':item_audit})
    for item_id,(spell_id,effect,classic,stats,kind,description) in EFFECTS.items():
        spell=spells[spell_id]; value=abs(spell_value(spell,effect))
        mechanics[str(item_id)]={'spellId':spell_id,'effect':effect,'classic':classic,'original':value,'stats':stats,'kind':kind,'durationIndex':int(spell['DurationIndex']),'durationMs':int(durations[int(spell['DurationIndex'])]['Duration']) if int(spell['DurationIndex']) else 0}
        effects[str(item_id)]=[description.format(value=value)]
    mechanics['45254']['frostStrike']=spell_value(spells[64962],3)/0.55
    sources={name:{'repository':repo,'commit':pin,'path':path,'sha256':digest,'url':f'https://github.com/{repo}/blob/{pin}/{path}'} for name,(repo,pin,path,digest) in SOURCES.items()}
    result={'revision':REVISION,'items':overrides,'unsupportedItemIds':sorted(unsupported),'effects':effects,'sources':sources}
    manifest={'revision':REVISION,'catalogSha256':hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'coverage':{'baselineItems':len(baseline),'originalTemplateItems':len(templates),'upgradedItems':len(changed),'nativeEffectOverrides':len(mechanics),'unsupportedItems':len(unsupported)},'unsupportedReasons':{str(k):v for k,v in sorted(unsupported.items())},'items':audits,'mechanics':mechanics,'sources':sources}
    return result,manifest

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--check',action='store_true'); args=parser.parse_args()
    result,manifest=generate()
    outputs={'data/wotlk/original-items.json':result,'data/wotlk/original-items-audit.json':manifest}
    for path,data in outputs.items():
        text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
        if args.check:
            if (ROOT/path).read_text()!=text: raise ValueError(f'{path} is stale; regenerate Original items')
        else: (ROOT/path).write_text(text)
    print(json.dumps(manifest['coverage']))

if __name__=='__main__': main()
