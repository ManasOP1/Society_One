/** Print / download helpers for invoices & receipts (browser print → PDF). */

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character
  );
}

export function printElementById(elementId: string, title: string) {
  const node = document.getElementById(elementId);
  if (!node) return;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    window.print();
    return;
  }
  win.opener = null;

  const appStyles = Array.from(
    document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style, link[rel="stylesheet"]'
    )
  )
    .map((element) => element.outerHTML)
    .join("\n");

  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${appStyles}
    <style>
      * { box-sizing: border-box; }
      html, body { background: #fff !important; }
      body {
        font-family: "Times New Roman", Times, Georgia, serif;
        color: #000;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        width: 198mm;
        max-width: 198mm;
        margin: 0 auto;
        transform-origin: top left;
      }
      table { width: 100%; border-collapse: collapse; }
      [data-print-document="invoice"] {
        width: 100%;
        max-width: none;
        font-family: "Times New Roman", Times, Georgia, serif !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      @media print {
        html, body {
          width: 210mm;
          min-height: 297mm;
          margin: 0 !important;
          padding: 0 !important;
        }
        body { overflow: visible !important; }
        .sheet { margin: 0 auto; }
        [data-print-document="invoice"] {
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
      }
    </style>
  </head><body><div class="sheet">${node.outerHTML}</div>
  </body></html>`);
  win.document.close();
  win.focus();

  let printed = false;
  const prepareAndPrint = async () => {
    if (printed) return;
    printed = true;

    await win.document.fonts?.ready;
    await Promise.all(
      Array.from(win.document.images).map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            })
      )
    );

    const sheet = win.document.querySelector<HTMLElement>(".sheet");
    if (sheet) {
      // 198 × 285 mm is the usable A4 area after 6 mm margins.
      const pxPerMm = 96 / 25.4;
      const availableHeight = 285 * pxPerMm;
      const scale = Math.min(1, availableHeight / sheet.scrollHeight);
      if (scale < 1) {
        // `zoom` changes layout dimensions, preventing an overflow page.
        sheet.style.setProperty("zoom", String(Math.max(scale - 0.01, 0.72)));
      }
    }

    window.setTimeout(() => {
      win.print();
    }, 100);
  };

  win.onload = () => void prepareAndPrint();
  if (win.document.readyState === "complete") {
    void prepareAndPrint();
  }
}
