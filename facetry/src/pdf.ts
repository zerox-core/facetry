// legacy 构建面向旧版 Chromium（Electron 内嵌浏览器），标准构建的模块 worker 在这些环境会静默挂起
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { ResumeLine } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PageData = {
  page: number
  /** PDF / 图片页：渲染好的画布（像素尺寸含 dpr，CSS 尺寸见 cssWidth/cssHeight） */
  canvas?: HTMLCanvasElement
  cssWidth?: number
  cssHeight?: number
  /** txt / docx 文本预览页：分页后的合成行 */
  textLines?: ResumeLine[]
}

export type DocData = {
  kind: 'pdf' | 'image' | 'text'
  pages: PageData[]
  lines: ResumeLine[]
  pageCount: number
}

const MAX_PAGES = 20

async function loadPdf(url: string): Promise<DocData> {
  const doc = await pdfjs.getDocument({
    url,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }).promise
  const pageCount = doc.numPages
  if (pageCount > MAX_PAGES) throw new Error(`当前支持 ${MAX_PAGES} 页以内的简历，请精简文件后重新上传`)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pages: PageData[] = []
  const lines: ResumeLine[] = []
  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.8, 1500 / base.width)
    const viewport = page.getViewport({ scale: scale * dpr })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.setAttribute('aria-label', `简历第 ${n} 页`)
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise

    // 行提取：把文本块按 y 坐标聚合成行，坐标归一化到 0–1（自顶向下）
    const text = await page.getTextContent()
    const rows: { y: number; x: number; parts: { x: number; text: string }[] }[] = []
    for (const item of text.items) {
      if (!('str' in item) || !item.str?.trim()) continue
      const t = pdfjs.Util.transform(base.transform, item.transform)
      const y = Math.max(0, Math.min(0.99, (t[5] - Math.hypot(t[2], t[3])) / base.height))
      const x = Math.max(0, Math.min(1, t[4] / base.width))
      let row = rows.find((r) => Math.abs(r.y - y) < 0.006)
      if (!row) {
        row = { y, x, parts: [] }
        rows.push(row)
      }
      row.parts.push({ x, text: item.str })
    }
    rows
      .sort((a, b) => a.y - b.y)
      .forEach((r, i) => {
        lines.push({
          id: `p${n}-l${i + 1}`,
          page: n,
          y: r.y,
          x: r.x,
          text: r.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(' '),
        })
      })

    pages.push({ page: n, canvas, cssWidth: canvas.width / dpr, cssHeight: canvas.height / dpr })
  }
  return { kind: 'pdf', pages, lines, pageCount }
}

async function loadImage(url: string): Promise<DocData> {
  const img = new Image()
  img.src = url
  img.alt = '上传的简历原图'
  await img.decode()
  const scale = Math.min(1, 1600 / img.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.setAttribute('aria-label', '简历原图')
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return {
    kind: 'image',
    pages: [{ page: 1, canvas, cssWidth: canvas.width, cssHeight: canvas.height }],
    lines: [],
    pageCount: 1,
  }
}

const CHARS_PER_LINE = 36
const LINES_PER_PAGE = 24

/** txt / docx：把纯文本按 ~36 字一行、24 行一页排成纸面，行 id 为 p<页>-l<序号> */
function layoutText(text: string): DocData {
  const source = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  if (!source.length) throw new Error('文件中没有可读取的文字，请换用 PDF 或清晰图片')
  const wrapped: string[] = []
  for (const line of source) {
    if (line.length <= CHARS_PER_LINE) {
      wrapped.push(line)
      continue
    }
    for (let i = 0; i < line.length; i += CHARS_PER_LINE) wrapped.push(line.slice(i, i + CHARS_PER_LINE))
  }
  const pageCount = Math.ceil(wrapped.length / LINES_PER_PAGE)
  if (pageCount > MAX_PAGES) throw new Error(`简历内容过长，请精简至 ${MAX_PAGES} 页以内`)
  const pages: PageData[] = []
  const lines: ResumeLine[] = []
  for (let p = 0; p < pageCount; p++) {
    const chunk = wrapped.slice(p * LINES_PER_PAGE, (p + 1) * LINES_PER_PAGE)
    const textLines = chunk.map((text, i) => ({
      id: `p${p + 1}-l${i + 1}`,
      text,
      page: p + 1,
      x: 0.08,
      y: (i + 1) / (LINES_PER_PAGE + 2),
    }))
    lines.push(...textLines)
    pages.push({ page: p + 1, textLines })
  }
  return { kind: 'text', pages, lines, pageCount }
}

/** 按 session.file 的扩展名加载简历文档；txt/docx 使用服务端提取的纯文本重新排版 */
export async function loadDocument(fileUrl: string, sessionText: string): Promise<DocData> {
  const ext = (fileUrl.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return loadPdf(fileUrl)
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return loadImage(fileUrl)
  return layoutText(sessionText)
}

const docCache = new Map<string, Promise<DocData>>()

/** 带缓存的加载：StrictMode 双调用与重新挂载共享同一份解析结果；失败自动失效以便重试 */
export function loadDocumentCached(key: string, fileUrl: string, sessionText: string): Promise<DocData> {
  let p = docCache.get(key)
  if (!p) {
    p = loadDocument(fileUrl, sessionText)
    p.catch(() => docCache.delete(key))
    docCache.set(key, p)
  }
  return p
}

/** 手动重载前调用，使下次加载重新解析 */
export function evictDocument(key: string) {
  docCache.delete(key)
}

/** 页面截图：最多 8 页、宽不超过 1280px，jpeg 0.72，供 analyze 调用 */
export function captureImages(doc: DocData, maxPages = 8, maxWidth = 1280): string[] {
  const images: string[] = []
  for (const p of doc.pages.slice(0, maxPages)) {
    if (!p.canvas) continue
    const src = p.canvas
    if (src.width <= maxWidth) {
      images.push(src.toDataURL('image/jpeg', 0.72))
      continue
    }
    const scale = maxWidth / src.width
    const out = document.createElement('canvas')
    out.width = maxWidth
    out.height = Math.round(src.height * scale)
    out.getContext('2d')!.drawImage(src, 0, 0, out.width, out.height)
    images.push(out.toDataURL('image/jpeg', 0.72))
  }
  return images
}
