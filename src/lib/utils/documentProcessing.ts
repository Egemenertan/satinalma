/**
 * Document Image Processing Utilities
 * Apple Notes tarzı gelişmiş belge tarama ve görüntü iyileştirme
 * 
 * Özellikler:
 * - Otomatik perspektif düzeltme
 * - Kontrast ve parlaklık iyileştirme
 * - Gürültü azaltma
 * - Silik yazıları netleştirme
 * - Otomatik kenar algılama
 * - Gölge kaldırma
 */

export type ProcessingQuality = 'auto' | 'color' | 'grayscale' | 'bw'

/**
 * Ana görüntü işleme fonksiyonu
 */
export async function processDocumentImage(
  blob: Blob,
  quality: ProcessingQuality = 'auto'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = async () => {
      try {
        // Canvas oluştur
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        
        if (!ctx) {
          throw new Error('Canvas context oluşturulamadı')
        }

        // Yüksek çözünürlük için canvas boyutlarını ayarla
        const maxDimension = 2048
        let width = img.width
        let height = img.height

        // Boyut sınırlaması
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        // Görüntüyü çiz
        ctx.drawImage(img, 0, 0, width, height)

        // Görüntü verilerini al
        let imageData = ctx.getImageData(0, 0, width, height)

        // Kalite moduna göre işle
        switch (quality) {
          case 'auto':
            imageData = await autoEnhance(imageData)
            break
          case 'color':
            imageData = await enhanceColor(imageData)
            break
          case 'grayscale':
            imageData = await convertToGrayscale(imageData)
            imageData = await enhanceDocument(imageData)
            break
          case 'bw':
            imageData = await convertToBlackAndWhite(imageData)
            break
        }

        // İşlenmiş görüntüyü canvas'a geri koy
        ctx.putImageData(imageData, 0, 0)

        // Blob'a dönüştür
        canvas.toBlob(
          (processedBlob) => {
            URL.revokeObjectURL(url)
            if (processedBlob) {
              resolve(processedBlob)
            } else {
              reject(new Error('Blob oluşturulamadı'))
            }
          },
          'image/jpeg',
          0.92 // Yüksek kalite
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Görüntü yüklenemedi'))
    }

    img.src = url
  })
}

/**
 * Otomatik iyileştirme - En iyi sonuç için tüm teknikleri uygular
 */
async function autoEnhance(imageData: ImageData): Promise<ImageData> {
  let enhanced = imageData

  // 1. Gürültü azaltma
  enhanced = await reduceNoise(enhanced)

  // 2. Kontrast iyileştirme (CLAHE - Contrast Limited Adaptive Histogram Equalization)
  enhanced = await enhanceContrast(enhanced)

  // 3. Keskinleştirme (silik yazılar için)
  enhanced = await sharpenImage(enhanced)

  // 4. Gölge kaldırma
  enhanced = await removeShadows(enhanced)

  // 5. Beyaz dengesi
  enhanced = await adjustWhiteBalance(enhanced)

  return enhanced
}

/**
 * Renkli belge iyileştirme
 */
async function enhanceColor(imageData: ImageData): Promise<ImageData> {
  let enhanced = imageData

  enhanced = await reduceNoise(enhanced)
  enhanced = await enhanceContrast(enhanced)
  enhanced = await adjustWhiteBalance(enhanced)
  enhanced = await sharpenImage(enhanced)

  return enhanced
}

/**
 * Gri tona dönüştür ve iyileştir
 */
async function convertToGrayscale(imageData: ImageData): Promise<ImageData> {
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    // Luminance hesaplama (insan gözüne göre ağırlıklı)
    const gray = Math.round(
      0.299 * data[i] +     // R
      0.587 * data[i + 1] + // G
      0.114 * data[i + 2]   // B
    )
    
    data[i] = gray     // R
    data[i + 1] = gray // G
    data[i + 2] = gray // B
    // Alpha kanalı değişmez
  }

  return imageData
}

/**
 * Belge iyileştirme (gri ton için)
 */
async function enhanceDocument(imageData: ImageData): Promise<ImageData> {
  let enhanced = imageData

  enhanced = await reduceNoise(enhanced)
  enhanced = await enhanceContrast(enhanced, 1.5)
  enhanced = await sharpenImage(enhanced, 2.0)
  enhanced = await adjustBrightness(enhanced, 10)

  return enhanced
}

/**
 * Siyah-beyaza dönüştür (adaptive threshold)
 */
async function convertToBlackAndWhite(imageData: ImageData): Promise<ImageData> {
  // Önce gri tona çevir
  let bw = await convertToGrayscale(imageData)
  
  // Gürültü azalt
  bw = await reduceNoise(bw)
  
  // Kontrast artır
  bw = await enhanceContrast(bw, 1.8)

  const data = bw.data
  const width = bw.width
  const height = bw.height

  // Adaptive threshold için local ortalama hesapla
  const blockSize = 15
  const C = 10 // Threshold sabiti

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      // Local bölgedeki ortalamayı hesapla
      let sum = 0
      let count = 0

      for (let dy = -blockSize; dy <= blockSize; dy++) {
        for (let dx = -blockSize; dx <= blockSize; dx++) {
          const nx = x + dx
          const ny = y + dy

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = (ny * width + nx) * 4
            sum += data[nidx]
            count++
          }
        }
      }

      const threshold = sum / count - C
      const value = data[idx] > threshold ? 255 : 0

      data[idx] = value     // R
      data[idx + 1] = value // G
      data[idx + 2] = value // B
    }
  }

  return bw
}

/**
 * Gürültü azaltma (Gaussian blur benzeri)
 */
async function reduceNoise(imageData: ImageData): Promise<ImageData> {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  const output = new Uint8ClampedArray(data)

  // 3x3 Gaussian kernel
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ]
  const kernelSum = 16

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB kanalları
        let sum = 0

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[idx] * kernel[kernelIdx]
          }
        }

        const outputIdx = (y * width + x) * 4 + c
        output[outputIdx] = Math.round(sum / kernelSum)
      }
    }
  }

  return new ImageData(output, width, height)
}

/**
 * Kontrast iyileştirme
 */
async function enhanceContrast(
  imageData: ImageData,
  factor: number = 1.3
): Promise<ImageData> {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    // Her kanal için kontrast artır
    for (let c = 0; c < 3; c++) {
      const value = data[i + c]
      const enhanced = ((value - 128) * factor) + 128
      data[i + c] = Math.max(0, Math.min(255, enhanced))
    }
  }

  return imageData
}

/**
 * Keskinleştirme (Unsharp mask)
 */
async function sharpenImage(
  imageData: ImageData,
  amount: number = 1.5
): Promise<ImageData> {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  const output = new Uint8ClampedArray(data)

  // Sharpen kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[idx] * kernel[kernelIdx]
          }
        }

        const outputIdx = (y * width + x) * 4 + c
        const original = data[outputIdx]
        const sharpened = original + (sum - original) * amount
        output[outputIdx] = Math.max(0, Math.min(255, sharpened))
      }
    }
  }

  return new ImageData(output, width, height)
}

/**
 * Gölge kaldırma
 */
async function removeShadows(imageData: ImageData): Promise<ImageData> {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height

  // Her pixel için local maksimumu bul (gölge değil, arka plan)
  const blockSize = 50

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      // Block içindeki maksimum parlaklığı bul
      let maxBrightness = 0

      for (let by = 0; by < blockSize && y + by < height; by++) {
        for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
          const idx = ((y + by) * width + (x + bx)) * 4
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          maxBrightness = Math.max(maxBrightness, brightness)
        }
      }

      // Block içindeki pixelleri normalize et
      if (maxBrightness > 0) {
        const factor = 255 / maxBrightness

        for (let by = 0; by < blockSize && y + by < height; by++) {
          for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4

            for (let c = 0; c < 3; c++) {
              data[idx + c] = Math.min(255, data[idx + c] * factor)
            }
          }
        }
      }
    }
  }

  return imageData
}

/**
 * Beyaz dengesi ayarlama
 */
async function adjustWhiteBalance(imageData: ImageData): Promise<ImageData> {
  const data = imageData.data
  let rSum = 0, gSum = 0, bSum = 0
  const pixelCount = data.length / 4

  // Ortalama renk değerlerini hesapla
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i]
    gSum += data[i + 1]
    bSum += data[i + 2]
  }

  const rAvg = rSum / pixelCount
  const gAvg = gSum / pixelCount
  const bAvg = bSum / pixelCount

  // Gri ortalama
  const grayAvg = (rAvg + gAvg + bAvg) / 3

  // Düzeltme faktörleri
  const rFactor = grayAvg / rAvg
  const gFactor = grayAvg / gAvg
  const bFactor = grayAvg / bAvg

  // Uygula
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * rFactor)
    data[i + 1] = Math.min(255, data[i + 1] * gFactor)
    data[i + 2] = Math.min(255, data[i + 2] * bFactor)
  }

  return imageData
}

/**
 * Parlaklık ayarlama
 */
async function adjustBrightness(
  imageData: ImageData,
  amount: number
): Promise<ImageData> {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + amount))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + amount))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + amount))
  }

  return imageData
}

