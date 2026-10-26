import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const w=new Window({url:'https://preview.example'});
w.document.body.innerHTML='<div id="app"></div><dialog id="editor"></dialog><div id="toast"></div>';
for(const k of ['window','document','localStorage','Blob','File','URL','Event','HTMLElement'])globalThis[k]=k==='window'?w:w[k];
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
let apiCalls=0,instances=[];
globalThis.fetch=async url=>{if(url==='/api/status')return new Response(JSON.stringify({configured:false,model:'unconfigured'}),{status:200});apiCalls++;throw new Error('No LLM call is permitted in preview');};
class WorkerFixture{constructor(){instances.push(this);}postMessage(input){this.input=input;if(instances.length===1)queueMicrotask(()=>this.onmessage({data:{type:'result',result:{edges:[{ects:999}],candidates:[{courseId:input.courses[0].id,moduleId:input.modules[0].id,score:.8,evidence:input.courses[0].description}]}}}));}terminate(){}}
globalThis.Worker=WorkerFixture;
const $=s=>w.document.querySelector(s);const saved=()=>JSON.parse(localStorage.getItem('coursewise.v2'));
await import('../dist/app.js');
test('unconfigured full mode is blocked, preview never calls LLM or assigns credits, cancellation preserves prior output',async()=>{
 await new Promise(r=>setTimeout(r,20));$('[data-action="demo"]').click();assert($('[data-action="match"]').disabled);
 const mode=$('#run-mode');mode.value='retrieval';mode.dispatchEvent(new w.Event('change',{bubbles:true}));assert(!$('[data-action="match"]').disabled);
 $('[data-action="match"]').click();await new Promise(r=>setTimeout(r,20));assert.equal(saved().edges.length,0);assert.equal(saved().assessments.length,0);assert.equal(saved().runInfo.mode,'retrieval');assert.equal(apiCalls,0);
 $('[data-action="match"]').click();assert($('[data-action="cancel"]'));$('[data-action="cancel"]').click();assert.equal(saved().runInfo.mode,'retrieval');assert.equal(saved().edges.length,0);assert.equal(apiCalls,0);
 // A late event from a cancelled worker cannot overwrite state.
 instances.at(-1).onmessage({data:{type:'result',result:{candidates:[],edges:[{ects:999}]}}});assert.equal(saved().edges.length,0);assert.equal(saved().candidates.length,1);
 w.happyDOM.abort();
});
