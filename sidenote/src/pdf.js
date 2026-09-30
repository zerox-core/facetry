import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 20;

// 解析简历文件：PDF 渲染为画布并抽取带坐标的文本行；图片直接转 dataURL；
// txt/docx 由后端已抽出的纯文本在前端分页为“文字稿”。
export async function parseResume(session) {
  const ext = session.file.split('.').pop();
  if (ext === 'pdf') return parsePdf(session.file);
  if (ext === 'png' || ext === 'jpg') return parseImage(session.file);
  return parseText(session.text || '');
}

async function parsePdf(file) {
  const doc = await pdfjs.getDocument(`/files/${file}`).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const pages = [], lines = [], images = [];
  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1400 / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push({ page: n, url: canvas.toDataURL('image/jpeg', 0.85), width: viewport.width, height: viewport.height });

    const text = await page.getTextContent();
    text.items.forEach((item, i) => {
      const t = (item.str || '').trim();
      if (!t) return;
      const transform = pdfjs.Util.transform(base.transform, item.transform);
      lines.push({
        id: `p${n}-l${i}`,
        text: t,
        page: n,
        y: Math.max(0, Math.min(0.99, (transform[5] - Math.hypot(transform[2], transform[3])) / base.height)),
        x: Math.max(0, Math.min(0.95, transform[4] / base.width)),
      });
    });

    const shot = document.createElement('canvas');
    const shotScale = Math.min(1, 1100 / viewport.width);
    shot.width = viewport.width * shotScale;
    shot.height = viewport.height * shotScale;
    shot.getContext('2d').drawImage(canvas, 0, 0, shot.width, shot.height);
    images.push(shot.toDataURL('image/jpeg', 0.7));
  }
  return { kind: 'pdf', pages, lines, images, pageCount };
}

async function parseImage(file) {
  const img = new Image();
  img.src = `/files/${file}`;
  await img.decode();
  const scale = Math.min(1, 1400 / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return {
    kind: 'image',
    pages: [{ page: 1, url: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height }],
    lines: [],
    images: [canvas.toDataURL('image/jpeg', 0.75)],
    pageCount: 1,
  };
}

const LINES_PER_PAGE = 42;

function parseText(text) {
  const raw = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const lines = raw.map((t, i) => ({
    id: `t-l${i}`,
    text: t,
    page: Math.floor(i / LINES_PER_PAGE) + 1,
    y: ((i % LINES_PER_PAGE) + 0.5) / LINES_PER_PAGE,
    x: 0.06,
  }));
  const pageCount = Math.max(1, Math.ceil(raw.length / LINES_PER_PAGE));
  const pages = Array.from({ length: pageCount }, (_, p) => ({
    page: p + 1,
    text: raw.slice(p * LINES_PER_PAGE, (p + 1) * LINES_PER_PAGE),
  }));
  return { kind: 'text', pages, lines, images: [], pageCount };
}
