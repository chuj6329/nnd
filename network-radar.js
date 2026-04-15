;(async () => {

const BASE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

function getFlag(code) {
  if (!code || code.toUpperCase() === "TW") return "🇨🇳"
  if (code.toUpperCase() === "XX" || code === "OK") return "🟢"
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt())
  )
}

// ------------------ HTTP 封装 ------------------
function httpGet(url, headers = {}, timeout = 5000) {
  return new Promise((resolve) => {
    $httpClient.get(
      { url, headers: { "User-Agent": BASE_UA, ...headers }, timeout },
      (err, resp, data) => {
        resolve({ err, resp, data })
      }
    )
  })
}

// ------------------ 网络请求逻辑 ------------------

async function fetchLocal() {
  const r = await httpGet("https://myip.ipip.net/json")
  try {
    const j = JSON.parse(r.data)
    return {
      ip: j?.data?.ip || "获取失败",
      loc: `${j?.data?.location?.[1] || ""} ${j?.data?.location?.[2] || ""}`.trim(),
    }
  } catch {
    return { ip: "获取失败", loc: "未知" }
  }
}

async function fetchProxy() {
  const r = await httpGet("http://ip-api.com/json/?lang=zh-CN")
  try {
    const j = JSON.parse(r.data)
    return {
      ip: j.query,
      loc: `${getFlag(j.countryCode)} ${j.city || j.country}`,
      isp: j.isp || j.org,
      cc: j.countryCode,
    }
  } catch {
    return { ip: "获取失败", loc: "未知", isp: "未知", cc: "XX" }
  }
}

async function fetchPurity() {
  const r = await httpGet("https://my.ippure.com/v1/info")
  try {
    return JSON.parse(r.data)
  } catch {
    return {}
  }
}

async function checkNetflix() {
  const test = async (id) => {
    const r = await httpGet(`https://www.netflix.com/title/${id}`, {}, 4000)
    return r?.resp?.status || 0
  }
  const full = await test(70143836)
  const orig = await test(81280792)
  if (full === 200) return "OK"
  if (orig === 200) return "🍿"
  return "❌"
}

async function checkDisney() {
  const r = await httpGet("https://www.disneyplus.com", {}, 4000)
  if (!r.resp || r.resp.status === 403) return "❌"
  if (r.resp.headers.location?.includes("unavailable")) return "❌"
  return "OK"
}

async function checkTikTok() {
  const r = await httpGet("https://www.tiktok.com/explore", {}, 4000)
  if (!r.resp || [401, 403].includes(r.resp.status)) return "❌"
  const m = r.data?.match(/"region":"([A-Z]{2})"/i)
  return m ? m[1] : "OK"
}

async function checkGPT() {
  const r = await httpGet("https://chatgpt.com/cdn-cgi/trace", {}, 3000)
  const m = r.data?.match(/loc=([A-Z]{2})/)
  return m ? m[1] : "OK"
}

async function checkClaude() {
  const r = await httpGet("https://claude.ai/login")
  if (!r.resp) return "❌"
  const body = r.data || ""
  if (body.includes("unavailable") || body.includes("certain regions")) return "❌"
  return "OK"
}

async function checkGemini() {
  const r = await httpGet("https://gemini.google.com/app", {}, 4000)
  if (!r.resp) return "❌"
  if (r.resp.headers.location?.includes("faq")) return "❌"
  return "OK"
}

// ------------------ 并发执行 ------------------

const [
  localData,
  proxyData,
  purityData,
  NF,
  DP,
  TK,
  Gpt,
  CL,
  GM,
] = await Promise.all([
  fetchLocal(),
  fetchProxy(),
  fetchPurity(),
  checkNetflix(),
  checkDisney(),
  checkTikTok(),
  checkGPT(),
  checkClaude(),
  checkGemini(),
])

// ------------------ 渲染逻辑 ------------------

function fmt(name, res, cc) {
  if (res === "🍿") return `${name} 🍿`
  if (res === "❌") return `${name} ❌`
  return `${name} ${getFlag(res === "OK" ? cc : res)}`
}

const videoText = [
  fmt("NF", NF, proxyData.cc),
  fmt("DP", DP, proxyData.cc),
  fmt("TK", TK, proxyData.cc),
].join("　")

const aiText = [
  fmt("GPT", Gpt, proxyData.cc),
  fmt("CL", CL, proxyData.cc),
  fmt("GM", GM, proxyData.cc),
].join("　")

// 判断属性
let native = "未知", nativeCol = "gray"
if (purityData.isResidential === true) native = "原生住宅"
else if (purityData.isResidential === false) native = "商业机房"

// 风险分
let risk = "无数据"
if (purityData.fraudScore !== undefined) {
  const s = purityData.fraudScore
  if (s >= 70) risk = `高危 (${s})`
  else if (s >= 30) risk = `中危 (${s})`
  else risk = `纯净 (${s})`
}

// ------------------ HTML 双列 UI ------------------

const html = `
<div style="font-family: -apple-system; padding: 10px;">

  <h2 style="font-size: 15px; margin: 0 0 10px 0;">
    🛡️ 网络诊断雷达
  </h2>

  <div style="display: flex; gap: 20px;">

    <!-- 左列：本地 -->
    <div style="flex: 1; font-size: 13px; line-height: 1.45;">
      <div>📶 环境：${$network.wifi?.ssid || "蜂窝 / 未知"}</div>
      <div>📡 公网：${localData.ip}</div>
      <div>📍 位置：${localData.loc}</div>
      <div>📺 影视：${videoText}</div>
    </div>

    <!-- 右列：代理 -->
    <div style="flex: 1; font-size: 13px; line-height: 1.45;">
      <div>🛫 出口：${proxyData.ip}</div>
      <div>📍 落地：${proxyData.loc}</div>
      <div>🏢 ISP：${proxyData.isp}</div>
      <div>🏠 属性：${native}</div>
      <div>🛡️ 纯净：${risk}</div>
      <div>🤖 AI：${aiText}</div>
    </div>

  </div>

</div>
`

$done({ html })

})()