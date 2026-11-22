"""Local evidence API and repeatable PubMed metadata ingestion."""
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request
from time import sleep

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from fastapi import FastAPI, HTTPException

ROOT = Path(__file__).parent
TRIALS = {"33567185": ("NCT03548935", "10.1056/nejmoa2032183"),
          "35658024": ("NCT04184622", "10.1056/nejmoa2206038")}
URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" + ",".join(TRIALS)
app = FastAPI(title="HealthInvest Evidence API")

def connection():
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row, connect_timeout=3)

def sync():
    for attempt in range(3):
        try:
            with urllib.request.urlopen(URL, timeout=20) as response:
                result = json.load(response)["result"]
            break
        except OSError:
            if attempt == 2:
                raise
            sleep(2 ** attempt)
    with connection() as db:
        db.execute((ROOT / "migrations/001_evidence.sql").read_text())
        for pmid, (nct, expected) in TRIALS.items():
            item = result[pmid]
            doi = next(a["value"] for a in item["articleids"] if a["idtype"] == "doi")
            if doi.lower() != expected or item["uid"] != pmid:
                raise ValueError("Publication identity mismatch")
            digest = hashlib.sha256(json.dumps(item, sort_keys=True).encode()).hexdigest()
            args = ("PubMed", pmid, URL, digest, Jsonb(item))
            db.execute("INSERT INTO source_versions(source,record_key,url,digest,payload) VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", args)
            version = db.execute("SELECT id FROM source_versions WHERE source=%s AND record_key=%s AND digest=%s", ("PubMed", pmid,digest)).fetchone()
            db.execute("""INSERT INTO publications VALUES(%s,%s,%s,%s,%s,%s,%s)
              ON CONFLICT(pmid) DO UPDATE SET doi=excluded.doi,nct=excluded.nct,title=excluded.title,
              journal=excluded.journal,published=excluded.published,source_id=excluded.source_id""",
              (pmid,doi,nct,item["title"],item["fulljournalname"],item["pubdate"],version["id"]))

@app.get("/api/v1/publications")
def publications():
    try:
        with connection() as db:
            return db.execute("""SELECT p.*,v.retrieved_at FROM publications p JOIN source_versions v
                ON v.id=p.source_id ORDER BY p.published DESC""").fetchall()
    except psycopg.Error as exc:
        raise HTTPException(503, "文献数据库暂不可用") from exc

if __name__ == "__main__" and sys.argv[1:] == ["sync"]:
    sync()

from typing import Literal
from pydantic import BaseModel, Field
import httpx

class ResearchQuestion(BaseModel):
    provider: Literal["deepseek","bailian"]
    question: str = Field(min_length=1,max_length=1500)
    ids: list[str] = Field(min_length=1,max_length=12)

@app.post("/api/v1/research")
def research(request: ResearchQuestion):
    providers = {
        "deepseek": ("DEEPSEEK_API_KEY","https://api.deepseek.com","deepseek-flash"),
        "bailian": ("DASHSCOPE_API_KEY","https://dashscope.aliyuncs.com/compatible-mode/v1","qwen-plus"),
    }
    key, base, model = providers[request.provider]
    if not os.getenv(key):
        raise HTTPException(503,"当前模型尚未配置")
    catalog = json.loads((ROOT.parent/"frontend/lib/records.json").read_text())
    if any(i.startswith("PMID ") for i in request.ids):
        for p in publications():
            catalog.append(dict(id="PMID "+p["pmid"],title=p["title"],doi=p["doi"],trial=p["nct"],url="https://pubmed.ncbi.nlm.nih.gov/"+p["pmid"]+"/"))
    sources = [s for s in catalog if s["id"] in request.ids]
    if len(sources)!=len(set(request.ids)):
        raise HTTPException(422,"部分来源未找到，请刷新页面")
    messages=[dict(role="system",content="你是中文研究助手。仅依据提供的记录回答，结论用对应的 [1] 等编号。题录无法证明疗效；证据不足明确指出。不要推测数值、诊疗或买卖建议。"),dict(role="user",content=json.dumps({"问题":request.question,"证据":{str(i):s for i,s in enumerate(sources,1)}},ensure_ascii=False))]
    try:
        res=httpx.post(base+"/chat/completions",headers={"Authorization":"Bearer "+os.environ[key]},json={"model":model,"messages":messages,"stream":False},timeout=50)
        res.raise_for_status()
        answer=res.json()["choices"][0]["message"]["content"]
        if not isinstance(answer,str) or not answer.strip():
            raise ValueError()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502,f"模型服务返回 HTTP {e.response.status_code}，可切换模型重试") from None
    except (httpx.HTTPError,ValueError,KeyError,IndexError):
        raise HTTPException(502,"模型暂未返回有效回答") from None
    return dict(answer=answer,model=model,sources=[{"title":s["title"],"url":s["url"]} for s in sources])
