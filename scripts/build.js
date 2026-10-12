import fs from 'node:fs';
const required=['index.html','src/clinical.js','src/extractor.js','src/app.js','src/storage.js','src/workflow.js','src/report.js','src/pdf.js','src/styles.css','src/cmo-visual.css'];
for (const f of required) if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);
// Ningún módulo puede contener llamadas de red ni marcadores de proveedores de IA.
for (const f of fs.readdirSync('src').filter(f=>f.endsWith('.js'))){const code=fs.readFileSync('src/'+f,'utf8'); if(/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket\s*\(|openai|anthropic|azure openai|api[_-]?key/i.test(code)) throw new Error(`External network/AI marker found in src/${f}`);}
fs.rmSync('dist',{recursive:true,force:true}); fs.mkdirSync('dist/src',{recursive:true}); for(const f of ['index.html']) fs.copyFileSync(f,'dist/'+f); for(const f of fs.readdirSync('src')) fs.copyFileSync('src/'+f,'dist/src/'+f); console.log('Build OK for /cmorespiratorio/');
