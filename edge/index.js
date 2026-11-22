import { DurableObject } from 'cloudflare:workers';


export class DailyQuota extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS daily_quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL)');
  }

  reserve(day, limit) {
    return this.sql.exec(
      'INSERT INTO daily_quota (day, used) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used',
      day,
      limit,
    ).toArray().length > 0;
  }
}
import records from '../frontend/lib/records.json'
import companies from '../frontend/lib/financials.json'
import papers from '../frontend/public/publications.json'
const origin='https://fdd77931-arch.github.io'
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'}
export default {async fetch(request,env){
 const send=(data,status=200)=>Response.json(data,{status,headers:cors})
 if(request.headers.get('Origin')!==origin)return send({detail:'来源不可用'},403)
 if(request.method==='OPTIONS')return new Response(null,{headers:cors})
 if(request.method!=='POST'||new URL(request.url).pathname!=='/research')return send({detail:'请求无效'},404)
 let body;try{body=await request.json()}catch{return send({detail:'输入无效'},400)}
 const {ids,question,provider}=body||{}
 if(!Array.isArray(ids)||!ids.length||ids.length>12||typeof question!=='string'||!question.trim()||question.length>1500||!['bailian','deepseek'].includes(provider))return send({detail:'请检查问题与来源'},400)
 const all=[...records.map(r=>({...r,annual:companies[r.id]})),...papers.map(p=>({...p,id:'PMID '+p.pmid,url:'https://pubmed.ncbi.nlm.nih.gov/'+p.pmid+'/'}))]
 const sources=all.filter(s=>ids.includes(s.id))
 if(!sources.length)return send({detail:'请选择可用来源'},400)
 const day=new Date().toISOString().slice(0,10)
 if(!await env.QUOTA.getByName('public-demo').reserve(day,100))return send({detail:'今日演示额度已用完'},429)
 const isQwen=provider==='bailian',model=isQwen?'qwen-plus':'deepseek-flash'
 try{
 const res=await fetch((isQwen?'https://dashscope.aliyuncs.com/compatible-mode/v1':'https://api.deepseek.com')+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+(isQwen?env.DASHSCOPE_API_KEY:env.DEEPSEEK_API_KEY),'Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:1600,messages:[{role:'system',content:'你是产业与投资研究员。以简洁中文回答。只能依据给定来源，逐条注明 [1] 等数字引用。保留财年、单位和币种。区别事实、推断与假设。没有股价或临床结果时明确证据不足。不得给出个性化交易建议。'},{role:'user',content:JSON.stringify({question,sources:sources.map((r,i)=>({number:i+1,...r}))})}]})})
 if(!res.ok)return send({detail:'模型暂不可用，可切换模型'},502)
 const text=(await res.json()).choices?.[0]?.message?.content
 return text?send({answer:text,model,sources:sources.map(({title,url})=>({title,url}))}):send({detail:'模型未返回答案'},502)
 }catch{return send({detail:'服务暂时不可达'},503)}
}}
