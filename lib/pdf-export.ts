import { fetchVideoTitle } from "@/lib/youtube";

export async function exportNotesToPdf(
  editorElement: HTMLElement,
  videoId: string,
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const title = (await fetchVideoTitle(videoId)) ?? "Untitled Video";
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  /* Render the actual editor element directly — this avoids issues with
     cloned base64 images not loading in offscreen elements. We use
     html2canvas's onclone to inject the header and style overrides
     only in the cloned render, keeping the real UI untouched. */
  const canvas = await html2canvas(editorElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    imageTimeout: 15000,
    onclone: (_doc: Document, clonedEl: HTMLElement) => {
      /* Force light theme colors in the clone for PDF readability */
      clonedEl.style.color = "#000";
      clonedEl.style.backgroundColor = "#fff";
      clonedEl.style.padding = "16px";

      /* Style timestamp chips for PDF */
      clonedEl.querySelectorAll(".timestamp-chip").forEach((el) => {
        const span = el as HTMLElement;
        span.style.cssText =
          "display:inline;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:4px;font-size:12px;font-weight:500;";
      });

      /* Style images */
      clonedEl.querySelectorAll("img").forEach((img) => {
        img.style.cssText =
          "max-width:100%;height:auto;display:block;border-radius:8px;margin:8px 0;";
      });

      /* Insert header at top of cloned element */
      const header = _doc.createElement("div");
      header.style.cssText =
        "margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb;";
      header.innerHTML = `
        <h1 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#000;">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#6b7280;font-size:11px;">${escapeHtml(videoUrl)}</p>
      `;
      clonedEl.insertBefore(header, clonedEl.firstChild);
    },
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let yOffset = 0;
  const usableHeight = pageHeight - margin * 2;

  while (yOffset < imgHeight) {
    if (yOffset > 0) pdf.addPage();

    pdf.addImage(
      imgData,
      "PNG",
      margin,
      margin - yOffset,
      imgWidth,
      imgHeight,
    );

    yOffset += usableHeight;
  }

  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");

  pdf.save(`notes-${slug || videoId}.pdf`);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
