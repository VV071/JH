import fs from 'node:fs';
import assert from 'node:assert/strict';
const pages=[]; const chapters=[];
for(let part=1;part<=4;part++) {
 const source=fs.readFileSync(`content/part${part}.txt`,'utf8').replace(/^\uFEFF/,'');
 let chapter; let number; let lines=[];
 const flush=()=>{if(number!==undefined){pages.push({number,chapter:chapter.number,title:chapter.title,text:lines.join('\n').trim()});lines=[];number=undefined;}};
 for(const line of source.split(/\r?\n/)) {
  const heading=line.match(/^# (\d+) \| (.+)$/); const marker=line.match(/^@(\d+)$/);
  if(heading){flush();chapter={number:Number(heading[1]),title:heading[2],page:(Number(heading[1])-1)*10+1};chapters.push(chapter);}
  else if(marker){flush();number=Number(marker[1]);}
  else if(number!==undefined)lines.push(line);
 }
 flush();
}
assert.equal(pages.length,200,'Exactly 200 authored story pages');
assert.equal(chapters.length,20);
for(const [i,p] of pages.entries()){assert.equal(p.number,i+1);assert.equal(p.chapter,Math.floor(i/10)+1);assert.ok(p.text.split(/\s+/).length>=65,`Page ${p.number} is too short`);assert.ok(!/TODO|lorem ipsum|placeholder/i.test(p.text));}
assert.equal(new Set(pages.map(p=>p.text)).size,200,'No duplicate page text');
assert.ok(pages.slice(0,100).every(p=>!(/aadhav/i.test(p.text+p.title))),'No name before page 101');
assert.match(pages[100].text,/“I'm Aadhav,”/);
assert.match(pages[2].text,/Exactly one year younger/);
fs.writeFileSync('app/story.json',JSON.stringify({pages,chapters}));
const words=pages.reduce((sum,p)=>sum+p.text.split(/\s+/).length,0);
console.log(JSON.stringify({pages:pages.length,chapters:chapters.length,words,firstNamePage:pages.find(p=>/Aadhav/.test(p.text)).number,minWords:Math.min(...pages.map(p=>p.text.split(/\s+/).length)),maxWords:Math.max(...pages.map(p=>p.text.split(/\s+/).length))}));
