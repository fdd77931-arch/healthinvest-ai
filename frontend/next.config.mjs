export default process.env.NEXT_PUBLIC_PAGES==='1'?{output:'export',basePath:'/healthinvest-ai',trailingSlash:true}:{
  async rewrites() {
    return [{source:'/api/v1/research',destination:(process.env.RESEARCH_API_ORIGIN || 'http://127.0.0.1:3186')+'/api/v1/research'},{source:'/api/v1/publications',destination:(process.env.EVIDENCE_API_ORIGIN || 'http://127.0.0.1:3185')+'/api/v1/publications'}]
  }
}
