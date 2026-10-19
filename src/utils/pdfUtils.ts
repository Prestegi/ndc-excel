import * as pdfjsLib from 'pdfjs-dist';

// Configure worker for pdfjs-dist
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
  } catch {
    // fallback if worker setting differs
  }
}

export interface ConvertedPage {
  pageNumber: number;
  fileName: string;
  dataUrl: string;
}

export async function processUploadedFile(file: File): Promise<ConvertedPage[]> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    // It's an image file (JPG, PNG, etc.)
    const dataUrl = await readFileAsDataUrl(file);
    return [
      {
        pageNumber: 1,
        fileName: file.name,
        dataUrl,
      },
    ];
  }

  // It's a PDF file - extract pages
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const pages: ConvertedPage[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    // Render at 2.0 scale for sharp OCR and passport photo extraction
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      await (page.render as any)({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      pages.push({
        pageNumber: i,
        fileName: `${file.name} (p.${i})`,
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      });
    }
  }

  return pages;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
