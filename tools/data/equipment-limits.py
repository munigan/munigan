"""Extract only 3.3.5 equipment restrictions; never execute source SQL."""
import json,re,pathlib,urllib.request,hashlib
root=pathlib.Path(__file__).resolve().parents[2]
sources={
 'item_template':('azerothcore/azerothcore-wotlk','db533ad7537a0641d076b13e5611f29f33558d06','data/sql/base/db_world/item_template.sql'),
 'ItemLimitCategory':('Kaev/AzerothcoreDBCToSQL','ef28c4205b329e11cc1327e8d817dbfa967a6797','ItemLimitCategory.sql')}
def records(sql):
 for match in re.finditer(r'INSERT INTO `[^`]+` VALUES\s+',sql):
  i=match.end();row=[];token='';quoted=None;inside=False
  while i<len(sql):
   c=sql[i];i+=1
   if quoted:
    if c=='\\':token+=sql[i];i+=1
    elif c==quoted:quoted=None
    else:token+=c
   elif c in "'\"":quoted=c
   elif c=='(':inside=True;row=[];token=''
   elif c==',' and inside:row.append(token);token=''
   elif c==')':row.append(token);yield row;inside=False;token=''
   elif c==';':break
   elif inside:token+=c
raw={}
for name,(repo,pin,path) in sources.items():
 file=root/'.cache'/f'{name}.sql'
 if not file.exists():urllib.request.urlretrieve(f'https://raw.githubusercontent.com/{repo}/{pin}/{path}',file)
 raw[name]=file.read_text()
categories={r[0]:{'name':r[1].replace('\\',''),'quantity':int(r[18]),'mode':int(r[19])} for r in records(raw['ItemLimitCategory'])}
columns=re.findall(r'^  `([^`]+)`',raw['item_template'],re.M)
db=json.loads((root/'data/wotlk/db.json').read_text());ids={v['id'] for k in ['items','gems'] for v in db[k]}
items={}
for row in records(raw['item_template']):
 item_id=int(row[0])
 if item_id not in ids:continue
 if len(row)!=len(columns):raise ValueError(f'Column mismatch at {item_id}')
 values=dict(zip(columns,row))
 items[str(item_id)]={'category':int(values['ItemLimitCategory']),'requiredSkill':int(values['RequiredSkill']),'requiredSkillRank':int(values['RequiredSkillRank']),'uniqueEquipped':bool(int(values['Flags'])&0x80000),'maxOwned':int(values['maxcount'])}
missing=sorted(ids-set(map(int,items)))
output={'sources':{k:{'repository':r,'commit':c,'path':p,'sha256':hashlib.sha256(raw[k].encode()).hexdigest()} for k,(r,c,p) in sources.items()},'categories':categories,'items':items,'missing':missing}
(root/'data/wotlk/equipment-limits.json').write_text(json.dumps(output,indent=2)+'\n')
print('Equipment restrictions:',len(items),'entries;',len(missing),'missing source entries')
