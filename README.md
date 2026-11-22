# HealthInvest AI

美国 GLP-1 行业与投资研究终端。[进入公开工作台](https://fdd77931-arch.github.io/healthinvest-ai/)

数据来源为 SEC 年报、ClinicalTrials.gov、CDC 与 PubMed。FY2022–2025 财务记录保留原币和申报链接。估值输入为用户假设。临床与财务资料以快照提供。

Next.js 前端由 GitHub Actions 构建和发布到 Pages。公开版 AI 研究请求发送到独立 Cloudflare Worker，每日限额 100 次。DEEPSEEK_API_KEY 和 DASHSCOPE_API_KEY 仅通过 Worker secrets 配置。本机可使用 backend 下的 FastAPI 与 PostgreSQL 版本。
