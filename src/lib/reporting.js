const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const openPrintTableDocument = async ({ title, subtitle, columns, rows }) => {
  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela do relatório.");
  }

  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const tableBody = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}" class="empty-row">Nenhum registro encontrado no periodo.</td></tr>`;

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; }
          .report-header { margin-bottom: 18px; }
          .report-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
          .report-subtitle { color: #6b7280; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; font-size: 12px; word-break: break-word; }
          th { background: #f3f4f6; font-weight: 700; }
          .empty-row { text-align: center; color: #6b7280; padding: 18px; }
          @page { size: A4 landscape; margin: 12mm; }
        </style>
      </head>
      <body>
        <header class="report-header">
          <div class="report-title">${escapeHtml(title)}</div>
          <div class="report-subtitle">${escapeHtml(subtitle)}</div>
        </header>
        <table>
          <thead><tr>${tableHead}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export const openPrintLabelsDocument = async ({ title, cards }) => {
  const printWindow = window.open("", "_blank", "width=960,height=720");

  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão.");
  }

  const content = cards.map((card) => `
    <article class="label-card">
      <div class="label-title">${escapeHtml(card.title || "-")}</div>
      <div class="label-subtitle">${escapeHtml(card.subtitle || "")}</div>
      ${card.qrPreview ? `<img class="label-qr" src="${card.qrPreview}" alt="${escapeHtml(card.alt || "QR")}" />` : ""}
    </article>
  `).join("");

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; }
          .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .label-card { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; min-height: 290px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; break-inside: avoid; }
          .label-title { width: 100%; text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 6px; }
          .label-subtitle { width: 100%; text-align: center; color: #6b7280; font-size: 12px; min-height: 30px; margin-bottom: 12px; }
          .label-qr { width: 180px; height: 180px; object-fit: contain; }
          @media print {
            body { padding: 12px; }
            .label-grid { gap: 12px; }
            .label-card { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="label-grid">${content}</div>
      </body>
    </html>
  `);

  printWindow.document.close();

  await new Promise((resolve) => {
    const images = Array.from(printWindow.document.images);

    if (images.length === 0) {
      resolve();
      return;
    }

    let loadedCount = 0;
    const finish = () => {
      loadedCount += 1;
      if (loadedCount >= images.length) {
        resolve();
      }
    };

    images.forEach((image) => {
      if (image.complete) {
        finish();
        return;
      }

      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
  });

  printWindow.focus();
  printWindow.print();
};
