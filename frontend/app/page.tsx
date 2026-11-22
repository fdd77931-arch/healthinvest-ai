'use client'
import {useState,useEffect} from 'react'
import Monitor from './monitor'
import Analysis from './analysis'
import Research from './research'
import snapshot from '../lib/records.json'
const pages=['市场总览','疾病研究','药物研发','投资分析','产业分析','AI 研究工作区','研究资料库']
const routes=['overview','diseases','pipeline','companies','industry','research','library']
type Draft={id:string;title:string;text:string}
export default function Terminal(){
 type Entry={id:string;title:string;group:string;sub:string;url:string;period:string;fields:Record<string,string|undefined>}
 const [papers,setPapers]=useState<Entry[]>([]),[sourceStatus,setSourceStatus]=useState('正在载入 PubMed 文献')
 const data:Entry[]=[...snapshot,...papers]
 useEffect(()=>{
   const controller=new AbortController()
   async function load(){
     try{
       const response=await fetch(process.env.NEXT_PUBLIC_PAGES==='1'?'/healthinvest-ai/publications.json':'/api/v1/publications',{signal:controller.signal})
       if(!response.ok)throw Error()
       const items: {pmid:string;title:string;doi:string;nct:string;journal:string;published:string;retrieved_at:string}[]=await response.json()
       setPapers(items.map(p=>({id:'PMID '+p.pmid,title:p.title,group:'医学文献',sub:p.journal,url:'https://pubmed.ncbi.nlm.nih.gov/'+p.pmid+'/',period:p.published,fields:{DOI:p.doi,'关联试验':p.nct,'检索时间':p.retrieved_at}})))
       setSourceStatus('PubMed 题录 · '+items.length+' 篇')
     }catch{if(!controller.signal.aborted)setSourceStatus('文献服务暂不可用，其他来源快照仍可查看')}
   }
   load()
   return ()=>controller.abort()
 },[])
 const [page,setPage]=useState(0),[query,search]=useState(''),[selected,select]=useState(''),[saved,save]=useState<string[]>([]),[notes,setNotes]=useState<Draft[]>([]),[edit,setEdit]=useState<Draft>({id:'',title:'',text:''}),[notice,status]=useState('')
 useEffect(()=>{function route(){setPage(Math.max(0,routes.indexOf(location.hash.slice(1))));select('');search('');status('')}route();window.addEventListener('hashchange',route);try{save(JSON.parse(localStorage.getItem('hi-stars')||'[]'));setNotes(JSON.parse(localStorage.getItem('hi-drafts')||'[]'))}catch{status('本机资料读取失败')}return()=>window.removeEventListener('hashchange',route)},[])
 function star(id:string){const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];try{localStorage.setItem('hi-stars',JSON.stringify(next));save(next)}catch{status('浏览器未允许保存')}}
 function persist(){const doc={...edit,id:edit.id||crypto.randomUUID()},next=[doc,...notes.filter(n=>n.id!==doc.id)];try{localStorage.setItem('hi-drafts',JSON.stringify(next));setNotes(next);setEdit(doc);status('草稿已保存到本机')}catch{status('保存失败，请检查浏览器存储权限')}}
 const record=data.find(x=>x.id===selected),rows=data.filter(x=>query?JSON.stringify(x).toLowerCase().includes(query.trim().toLowerCase()):page===6?saved.includes(x.id):[1,2,3].includes(page)?x.group===(page===3?"企业研究":pages[page]):true)
 return <><aside><strong><em>H</em> HealthInvest <small>AI</small></strong><label>研究终端</label><nav>{pages.map((n,i)=><a key={n} href={'#'+routes[i]} aria-current={page===i?'page':undefined}>{n}</a>)}</nav><footer>美国市场 / 代谢性疾病</footer></aside><main><header><span>研究工作台　/　{pages[page]}</span><input aria-label="全局检索" value={query} onChange={e=>{search(e.target.value);select('')}} placeholder="搜索公司、药物、NCT…"/></header><article><small>HEALTHCARE INTELLIGENCE</small><h1>{query?'检索结果':pages[page]}</h1>
 {!query && page===0 && <><h2>GLP-1 产业与投资研究</h2><p><a href="#industry">比较竞争格局 →</a>　 <a href="#companies">分析财务与估值 →</a></p><section className="metrics">{data.filter(x=>x.group==='企业研究'||x.id==='NHANES').map(x=><button key={x.id} onClick={()=>select(x.id)}><small>{x.title}</small><b>{Object.values(x.fields)[0]}</b><span>{x.id==='NHANES'?'成人肥胖患病率':'年度营收'} · {x.period}</span></button>)}</section><Monitor/><p className="status">行情未接入　·　指数、股价及估值暂无报价</p></>}
 {!query && page===1 && <section className="panel"><h2>美国成人肥胖患病率</h2><p>NHANES · 2021.08–2023.08 · 实测 BMI ≥30 · 粗率</p>{Object.entries(data[0].fields).slice(1,4).map(([k,v])=><div className="bar" key={k}><span>{k}</span><i style={{width:String(v)}}/><b>{v}</b></div>)}<a href={data[0].url}>查看 CDC 表 1 ↗</a></section>}
 {!query && page===3 && <Analysis/>}
 {!query && page===4 && <Analysis industry/>}
 {!query && page===4 && <section className="panel"><h2>GLP-1 竞争研究</h2><p>按申办方查看试验人群、终点及观察时长，再核对公司披露。跨试验结果不构成头对头证据，公司总营收也不能代表单品销售额。</p>{data.filter(x=>x.group==='药物研发').map(x=><button key={x.id} onClick={()=>select(x.id)}>{x.fields['申办方']}　·　{x.title} ↗</button>)}</section>}
 {!query && page===5 && <Research ids={saved.length?saved:data.map(x=>x.id)} insert={s=>setEdit(e=>({...e,text:[e.text,s].filter(Boolean).join("\n\n")}))}/>}
 {!query && page===5 && <section className="panel"><h2>研究草稿</h2><p>可将已收藏来源插入草稿，保存到本机继续编辑。</p><input aria-label="草稿标题" placeholder="研究问题或标题" value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/><textarea aria-label="研究笔记" placeholder="记录研究假设、证据和局限…" value={edit.text} onChange={e=>setEdit({...edit,text:e.target.value})}/><button disabled={!saved.length} onClick={()=>setEdit({...edit,text:edit.text+'\n'+data.filter(x=>saved.includes(x.id)).map(x=>x.title+' · '+x.period+'\n'+x.url).join('\n')})}>插入收藏来源</button><button disabled={!edit.title.trim()||!edit.text.trim()} onClick={persist}>保存草稿</button><button onClick={()=>{setEdit({id:'',title:'',text:''});status('已打开空白草稿')}}>新建草稿</button></section>}
 {!query && page===6 && <section className="panel"><h2>我的草稿</h2>{notes.length?notes.map(n=><button key={n.id} onClick={()=>{setEdit(n);location.hash='research'}}>{n.title} ↗</button>):<p>研究工作区保存的草稿会出现在这里。</p>}</section>}
 <p role="status">{notice || sourceStatus}</p><section className="panel"><h2>{query?'匹配记录':page===6?'已收藏来源':'研究记录'} <small>{rows.length}</small></h2><div className="row headings"><span>研究对象 / 来源</span><span>报告期或更新日</span><span>资料库</span></div>{rows.map(x=><div className="row" key={x.id}><button className="name" onClick={()=>select(x.id)}>{x.title}<small>{x.id} · {x.group}</small></button><time>{x.period}</time><button aria-pressed={saved.includes(x.id)} onClick={()=>star(x.id)}>{saved.includes(x.id)?'已收藏':'收藏'}</button></div>)}{!rows.length&&<p>{query?'没有匹配的本地记录。':'暂无收藏，可从研究记录中添加。'}</p>}</section><p>来源快照 · 2026-11-22 核取　｜　市场范围：美国上市证券</p></article></main>{record&&<dialog open ref={el=>el?.focus()} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape')select('')}}><button className="close" onClick={()=>select('')}>关闭 ×</button><small>{record.group} / {record.id}</small><h2>{record.title}</h2><p>{record.sub}</p><dl>{Object.entries(record.fields).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{data.filter(x=>x.fields['关联试验']===record.id || x.id===record.fields['关联试验']).map(x=><p key={x.id}><button onClick={()=>select(x.id)}>{x.group} · {x.title} ↗</button></p>)}<a href={record.url} target="_blank" rel="noreferrer">核对原始记录 ↗</a></dialog>}</>}
