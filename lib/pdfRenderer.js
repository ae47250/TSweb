import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export async function renderPdfBuffer(html, { mobile = false } = {}) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: mobile ? { width: 390, height: 844 } : { width: 816, height: 1056 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: mobile ? undefined : "Letter",
      width: mobile ? "390px" : undefined,
      height: mobile ? "844px" : undefined,
      printBackground: true,
      margin: mobile
        ? { top: "0.2in", right: "0.15in", bottom: "0.2in", left: "0.15in" }
        : { top: "0.35in", right: "0.35in", bottom: "0.35in", left: "0.35in" },
    });
  } finally {
    await browser.close();
  }
}
