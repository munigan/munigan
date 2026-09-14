import ts from 'typescript';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(), upstream=resolve('.cache/wotlk'), out=resolve('data/wotlk');
const specs=['balance_druid','feral_druid','elemental_shaman','enhancement_shaman','hunter','mage','rogue','retribution_paladin','shadow_priest','smite_priest','warlock','warrior','deathknight'];
await mkdir(out,{recursive:true});await mkdir('.cache/extract',{recursive:true});
const imports:string[]=[],exports:string[]=[];
for(const spec of specs){
 const source=await readFile(`${upstream}/ui/${spec}/sim.ts`,'utf8');
 const ast=ts.createSourceFile('sim.ts',source,ts.ScriptTarget.Latest,true);
 let config:ts.ObjectLiteralExpression|undefined;
 function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='registerSpecConfig')config=n.arguments[1] as ts.ObjectLiteralExpression;ts.forEachChild(n,visit)}visit(ast);
 if(!config)throw Error(`No config: ${spec}`);
 const properties=config.properties.filter(p=>['defaults','raidSimPresets','autoRotation'].includes(p.name?.getText(ast)??''));
 const prelude=ast.statements.filter(ts.isImportDeclaration).filter(n=>/core\/proto\/|presets/.test(n.moduleSpecifier.getText(ast))).map(n=>{const path=(n.moduleSpecifier as ts.StringLiteral).text;return /presets/.test(path)?n.getText(ast).replace(path,resolve(upstream,'ui',spec,path)):n.getText(ast)}).join('\n');
 const props=properties.map(p=>{if(p.name?.getText(ast)!=='defaults')return p.getText(ast);const literal=(p as ts.PropertyAssignment).initializer as ts.ObjectLiteralExpression;return 'defaults:{'+literal.properties.filter(v=>!['gear','epWeights'].includes(v.name?.getText(ast)??'')).map(v=>v.getText(ast)).join(',')+'}'}).join(',');
 const text=prelude+`\nconst getSpecIcon=()=>'';const specNames=new Proxy({}, {get:(_,k)=>String(k)});\nexport const config={${props}};export const presets=Presets;`;
 const path=`.cache/extract/${spec}.ts`;
 await writeFile(path,text.replaceAll(/(['"])\.\.\/core\/proto\//g,`$1${root}/src/generated/wotlk/`));
 imports.push(`import * as ${spec} from '${resolve(path)}';`);exports.push(spec);
}
const stub=`import {EquipmentSpec} from '${root}/src/generated/wotlk/common.ts';import {APLRotation} from '${root}/src/generated/wotlk/apl.ts';import {SavedRotation} from '${root}/src/generated/wotlk/ui.ts';export const makePresetGear=(name,data,conditions={})=>({name,gear:EquipmentSpec.fromJson(data),conditions});export const makePresetAPLRotation=(name,data,conditions={})=>({name,rotation:SavedRotation.create({rotation:APLRotation.fromJson(data)}),conditions});export const makePresetSimpleRotation=(name,spec,data,conditions={})=>({name,rotation:SavedRotation.create({rotation:{type:2,simple:{specRotationJson:JSON.stringify(data)}}}),conditions});`;
await writeFile('.cache/extract/preset-utils.ts',stub);
await build({stdin:{contents:imports.join('\n')+`\nexport const modules={${exports.join(',')}};`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:'.cache/extract/modules.cjs',plugins:[{name:'pinned-data-only',setup(b){b.onLoad({filter:/talents\/hunter_pet\.ts$/},async args=>{const code=await readFile(args.path,'utf8');const ast=ts.createSourceFile('pet.ts',code,ts.ScriptTarget.Latest,true);const kept=ast.statements.filter(ts.isVariableStatement).filter(n=>n.declarationList.declarations.some(d=>['ferocityDefault','ferocityBMDefault'].includes(d.name.getText(ast))));return {contents:`import {HunterPetTalents} from '${root}/src/generated/wotlk/hunter.ts';`+kept.map(n=>n.getText(ast)).join('\n'),loader:'ts',resolveDir:root};});b.onResolve({filter:/core\/preset_utils/},()=>({path:resolve('.cache/extract/preset-utils.ts')}));b.onResolve({filter:/core\/proto\//},args=>({path:resolve('src/generated/wotlk',args.path.split('/').pop()!.replace(/\.js$/,'.ts'))}));}}]});
const require=createRequire(import.meta.url);const {modules}=require(resolve('.cache/extract/modules.cjs'));
const serialized:Record<string,unknown>={};for(const [spec,value]of Object.entries(modules)){const v=value as {config:Record<string,unknown>;presets:unknown};serialized[spec]={defaults:v.config.defaults,variants:v.config.raidSimPresets,presets:v.presets};}
await writeFile(`${out}/presets.json`,JSON.stringify(serialized,null,2)+'\n');
await copyFile(`${upstream}/assets/database/db.json`,`${out}/db.json`);
await writeFile(`${out}/versions.json`,JSON.stringify({engine:'563e4a08cb15729f1fdcbcf68e6d68224553bfef',schema:'563e4a08cb15729f1fdcbcf68e6d68224553bfef',presets:'563e4a08cb15729f1fdcbcf68e6d68224553bfef',catalog:'563e4a08cb15729f1fdcbcf68e6d68224553bfef:335rules-v1',optimizer:'top-gear-uniform-v1'},null,2)+'\n');
console.log(`Extracted ${specs.length} DPS modules and their upstream variants.`);
// Extract class equipment tables and talent field order directly from the pinned UI source.
const utilText=await readFile(`${upstream}/ui/core/proto_utils/utils.ts`,'utf8');
const utilAst=ts.createSourceFile('utils.ts',utilText,ts.ScriptTarget.Latest,true);
const raceNames=['druidRaces','hunterRaces','mageRaces','paladinRaces','priestRaces','rogueRaces','shamanRaces','warlockRaces','warriorRaces','deathKnightRaces'];
const tableNames=['classToMaxArmorType','classToEligibleRangedWeaponTypes','classToEligibleWeaponTypes','specToEligibleRaces',...raceNames];
const tables=utilAst.statements.filter(ts.isVariableStatement).filter(n=>n.declarationList.declarations.some(d=>tableNames.includes(d.name.getText(utilAst))));
await build({stdin:{contents:`import {Class,Spec,Race,ArmorType,RangedWeaponType,WeaponType} from '${root}/src/generated/wotlk/common.ts';`+tables.map(n=>n.getText(utilAst)).join('\n'),resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:'.cache/extract/equipment.cjs'});
await writeFile(`${out}/equipment-rules.json`,JSON.stringify(require(resolve('.cache/extract/equipment.cjs')),null,2)+'\n');
const classIds:Record<string,number>={},glyphs:Record<string,Record<string,number>>={},talents:Record<string,unknown>={};
const common=await readFile(`${upstream}/proto/common.proto`,'utf8');
for(const name of ['druid','hunter','mage','paladin','priest','rogue','shaman','warlock','warrior','deathknight']){
 const title=name[0].toUpperCase()+name.slice(1);const match=common.match(new RegExp(`Class${title}\\s*=\\s*(\\d+)`));if(!match)throw Error(name);classIds[name]=Number(match[1]);
 const proto=await readFile(`${upstream}/proto/${name}.proto`,'utf8');glyphs[match[1]]=Object.fromEntries([...proto.matchAll(/\b(GlyphOf\w+)\s*=\s*(\d+)/g)].map(m=>[m[1].toLowerCase(),Number(m[2])]));
 talents[match[1]]=JSON.parse(await readFile(`${upstream}/ui/core/talents/trees/${name}.json`,'utf8'));
}
await writeFile(`${out}/glyph-names.json`,JSON.stringify(glyphs,null,2)+'\n');await writeFile(`${out}/talent-trees.json`,JSON.stringify(talents,null,2)+'\n');
// Preserve upstream automatic rotation decisions as generated source, using a small Player facade at runtime.
let auto='// @ts-nocheck\n// Generated from the pinned simulator autoRotation functions. Do not edit.\nimport data from "../../../data/wotlk/presets.json";\nimport {HandType,ItemSlot} from "./common";\nimport {ShamanImbue} from "./shaman";\nexport const autoRotations={\n';
for(const spec of specs){const source=await readFile(`${upstream}/ui/${spec}/sim.ts`,'utf8');const ast=ts.createSourceFile('sim.ts',source,ts.ScriptTarget.Latest,true);let arrow:ts.Node|undefined;function visit(n:ts.Node){if(ts.isPropertyAssignment(n)&&n.name.getText(ast)==='autoRotation')arrow=n.initializer;ts.forEachChild(n,visit)}visit(ast);if(!arrow)throw Error(`Missing rotation ${spec}`);auto+=JSON.stringify(spec)+':'+arrow.getText(ast).replaceAll('Presets.',`data.${spec}.presets.`)+',\n';}auto+='};\n';await writeFile('src/generated/wotlk/auto-rotations.ts',auto.replace(/[ \t]+$/gm,''));
// Import after refreshing item data, so validation sees the new catalog.
const {validatePurchaseManifest}=await import('./purchases');
validatePurchaseManifest();
