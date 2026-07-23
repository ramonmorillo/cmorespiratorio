import fs from 'node:fs';
for (const f of ['index.html','src/clinical.js','src/extractor.js','src/app.js','src/storage.js','src/styles.css']) if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);
const app=fs.readFileSync('src/extractor.js','utf8'); if(/fetch\s*\(|XMLHttpRequest|openai|anthropic|azure openai|api[_-]?key/i.test(app)) throw new Error('External network/AI marker found');
fs.rmSync('dist',{recursive:true,force:true}); fs.mkdirSync('dist/src',{recursive:true}); for(const f of ['index.html']) fs.copyFileSync(f,'dist/'+f); for(const f of fs.readdirSync('src')) fs.copyFileSync('src/'+f,'dist/src/'+f); console.log('Build OK for /cmorespiratorio/');
