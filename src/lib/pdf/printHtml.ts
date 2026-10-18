/**
 * Hidden iframe + native print. Never waits on a single onload —
 * document.write() after append often never fires it, which used to hang PDF export.
 */

const PRINT_IFRAME_LOAD_MS = 400
const IMAGE_WAIT_MS = 2000
const CLEANUP_MS = 1000

type PrintHtmlOptions = {
  width?: string
  height?: string
}

function waitForImages(doc: Document | null): Promise<void> {
  const images = Array.from(doc?.images ?? [])
  if (images.length === 0) return Promise.resolve()

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          setTimeout(done, IMAGE_WAIT_MS)
        })
    )
  ).then(() => undefined)
}

export async function printHtmlDocument(
  htmlContent: string,
  options: PrintHtmlOptions = {}
): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.top = '-99999px'
  iframe.style.left = '-99999px'
  iframe.style.width = options.width ?? '210mm'
  iframe.style.height = options.height ?? '297mm'
  iframe.style.border = 'none'

  const iframeReady = Promise.race([
    new Promise<void>((resolve) => {
      iframe.onload = () => resolve()
    }),
    new Promise<void>((resolve) => setTimeout(resolve, PRINT_IFRAME_LOAD_MS)),
  ])

  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    iframe.remove()
    throw new Error('Iframe document not accessible')
  }

  iframeDoc.open()
  iframeDoc.write(htmlContent)
  iframeDoc.close()

  await iframeReady
  await waitForImages(iframe.contentDocument)
  await new Promise<void>((resolve) => setTimeout(resolve, 50))

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()

  setTimeout(() => iframe.remove(), CLEANUP_MS)
}
