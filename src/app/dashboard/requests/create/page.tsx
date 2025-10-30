'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { createClient } from '@/lib/supabase/client'
// createClientComponentClient kaldırıldı - createClient kullanılıyor
import { useToast } from '@/components/ui/toast'
import { createMultiMaterialPurchaseRequest } from '@/lib/actions'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { 
  Package, 
  Building2, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  ArrowLeft,
  Save,
  FileText,
  Hash,
  Weight,
  Tag,
  Target,
  Settings,
  Camera,
  Image as ImageIcon,
  Upload,
  X,
  Wrench,
  Ruler,
  Truck,
  Package2,
  Zap,
  Sparkles,
  Grid3X3,
  List,
  Shield,
  Palette,
  Search,
  Loader2,
  TreePine
} from 'lucide-react'



const steps = [
  { id: 1, title: 'Şantiye Bilgileri', icon: Building2 },
  { id: 2, title: 'Malzeme Sınıfı', icon: Grid3X3 },
  { id: 3, title: 'Alt Kategori', icon: List },
  { id: 4, title: 'Malzeme Seçimi', icon: Package },
  { id: 5, title: 'Malzeme Detayları', icon: FileText },
  { id: 6, title: 'Kullanım & Zamanlama', icon: Target },
  { id: 7, title: 'Onay & Gönderim', icon: CheckCircle2 }
]

// Helper fonksiyonlar
const getIconForClass = (className: string) => {
  const iconMap: Record<string, string> = {
    'İş Araçları': 'Wrench',
    'Mimari Malzemeler': 'Ruler', 
    'Kaba İnşaat': 'Truck',
    'Mobilyasyon': 'Package2',
    'Mekanik': 'Settings',
    'Elektrik': 'Zap',
    'Temizlik': 'Sparkles',
    'İş Güvenliği': 'Shield',
    'Boyalar': 'Palette'
  }
  
  // Partial match için
  for (const [key, icon] of Object.entries(iconMap)) {
    if (className.toLowerCase().includes(key.toLowerCase())) {
      return icon
    }
  }
  return 'Package'
}

const getColorForClass = (className: string) => {
  const colorMap: Record<string, string> = {
    'İş Araçları': '#f59e0b',
    'Mimari Malzemeler': '#8b5cf6',
    'Kaba İnşaat': '#ef4444',
    'Mobilyasyon': '#06b6d4',
    'Mekanik': '#10b981',
    'Elektrik': '#f59e0b',
    'Temizlik': '#ec4899',
    'İş Güvenliği': '#6366f1',
    'Boyalar': '#84cc16'
  }
  
  // Partial match için
  for (const [key, color] of Object.entries(colorMap)) {
    if (className.toLowerCase().includes(key.toLowerCase())) {
      return color
    }
  }
  return '#6b7280'
}

const getIconForGroup = (groupName: string) => {
  const iconMap: Record<string, string> = {
    'elektrik': 'Zap',
    'electric': 'Zap',
    'sıva': 'Settings',
    'zemin': 'Package2',
    'aydınlatma': 'Sparkles',
    'kaplama': 'Package2',
    'genel': 'Package',
    'şantiye': 'Building2',
    'çevre': 'TreePine',
    'malzeme': 'Package'
  }
  
  const groupLower = groupName.toLowerCase()
  
  // Partial match için
  for (const [key, icon] of Object.entries(iconMap)) {
    if (groupLower.includes(key)) {
      return icon
    }
  }
  return 'Package'
}

const getColorForGroup = (groupName: string) => {
  // Tasarım dilimize uygun olarak sadece gri tonları kullan
  return '#6b7280'
}

export default function CreatePurchaseRequestPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [sites, setSites] = useState([])
  const [userSite, setUserSite] = useState(null)
  const [siteImages, setSiteImages] = useState({})
  const [materialClasses, setMaterialClasses] = useState([])
  const [materialGroups, setMaterialGroups] = useState([])
  const [materialItems, setMaterialItems] = useState([])
  const [currentStep, setCurrentStep] = useState(1)
  const [isCheckingSite, setIsCheckingSite] = useState(true) // Kullanıcı şantiye kontrolü için
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    class: string
    group: string
    item_name: string
    display_text: string
    score?: number
    highlightCount?: number
  }>>([])
  
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [formData, setFormData] = useState({
    construction_site: '',
    construction_site_id: '',
    material_class: '',
    material_group: '',
    purpose: '',
    required_date: '',
    specifications: ''
  })
  
  // Çoklu malzeme seçimi için yeni state
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{
    id: string
    material_class: string
    material_group: string
    material_item_name: string
    material_name: string
    material_description: string
    unit: string
    quantity: string
    brand: string
    specifications: string  // Her malzeme için ayrı teknik özellikler
    purpose: string          // Her malzeme için ayrı kullanım amacı
    delivery_date: string    // Her malzeme için ayrı teslimat tarihi
    image_urls: string[]
    uploaded_images: File[]  // Her malzeme için ayrı yüklenen dosyalar
    image_preview_urls: string[]  // Her malzeme için ayrı önizleme URL'leri
  }>>([])
  
  const [currentMaterialIndex, setCurrentMaterialIndex] = useState(0)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Yeni malzeme oluşturma modal state'leri
  const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false)
  const [createMaterialData, setCreateMaterialData] = useState({
    class: '',
    group: '',
    item_name: ''
  })
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false)

  // Cleanup URL objects when component unmounts
  useEffect(() => {
    return () => {
      selectedMaterials.forEach(material => {
        (material.image_preview_urls || []).forEach(url => URL.revokeObjectURL(url))
      })
    }
  }, [selectedMaterials])

  // Dış tıklamada arama sonuçlarını kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.search-container')) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Şantiyeleri ve kullanıcı bilgilerini çek
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Önce kullanıcının şantiye bilgisini kontrol et
        const { data: { user } } = await supabase.auth.getUser()
        let hasUserSite = false
        
        if (user) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('construction_site_id')
            .eq('id', user.id)
            .single()

          if (!profileError && profileData?.construction_site_id) {
            // Kullanıcının şantiye bilgisini ayrı sorgu ile çek
            const { data: siteData, error: siteError } = await supabase
              .from('sites')
              .select('id, name')
              .eq('id', profileData.construction_site_id)
              .single()

            if (!siteError && siteData) {
              // Kullanıcının şantiyesi var, otomatik seç ve step 1'i atla
              setUserSite(siteData)
              setFormData(prev => ({
                ...prev,
                construction_site: siteData.name,
                construction_site_id: siteData.id
              }))
              setCurrentStep(2) // Step 1'i atla - kategori seçimine geç
              hasUserSite = true
            }
          }
        }
        
        // Kullanıcı şantiye kontrolü tamamlandı
        setIsCheckingSite(false)

        // Şantiyeleri çek (sadece kullanıcının şantiyesi yoksa gerekli)
        if (!hasUserSite) {
          const { data: sitesData, error: sitesError } = await supabase
            .from('sites')
            .select('id, name')
            .order('name')

          if (sitesError) {
            console.error('Şantiyeler yüklenirken hata:', sitesError)
          } else {
            setSites(sitesData || [])
            
            // Şantiye resimlerini storage'dan çek
            if (sitesData && sitesData.length > 0) {
              const imageUrls = {}
              
              // Proje isimleri ve dosya adları eşleştirmesi
              const imageMapping = {
                'courtyard': 'courtyard.webp',
                'la casalia': 'lacasalia.webp',
                'la isla': 'laisla.webp',
                'natulux': 'natulux.webp',
                'querencia': 'querencia.webp',
                'four seasons life 3': 'fourseosonlife3.webp',
                'fourseasons': 'fourseosonlife3.webp'
              }
              
              for (const site of sitesData) {
                try {
                  // Şantiye adını küçük harfe çevir ve eşleşme ara
                  const siteName = site.name.toLowerCase()
                  let imageFileName = null
                  
                  // Exact match veya partial match ara
                  for (const [key, fileName] of Object.entries(imageMapping)) {
                    if (siteName.includes(key) || key.includes(siteName)) {
                      imageFileName = fileName
                      break
                    }
                  }
                  
                  if (imageFileName) {
                    const { data: imageData } = supabase.storage
                      .from('satinalma')
                      .getPublicUrl(imageFileName)
                    
                    if (imageData.publicUrl) {
                      imageUrls[site.name] = imageData.publicUrl
                    }
                  }
                } catch (error) {
                  console.error(`${site.name} için resim yüklenirken hata:`, error)
                }
              }
              setSiteImages(imageUrls)
            }
          }
        }

        // Malzeme sınıflarını çek (all_materials tablosundan farklı class değerleri)
        const { data: classesData, error: classesError } = await supabase
          .from('all_materials')
          .select('class')
          .not('class', 'is', null)
          .not('class', 'eq', '')
          .order('class')

        if (classesError) {
          console.error('Malzeme sınıfları yüklenirken hata:', classesError)
        } else {
          console.log('Raw class data:', classesData)
          
          // Farklı class değerlerini filtrele - sadece string değerleri al
          const classNames = classesData
            ?.map(item => item.class)
            ?.filter(cls => typeof cls === 'string' && cls.trim() !== '') || []
            
          const uniqueClasses = Array.from(new Set(classNames))
            .filter(Boolean)
            .sort()
            .map((className, index) => ({
              id: index + 1,
              name: className,
              description: `${className} kategorisindeki malzemeler`,
              icon: getIconForClass(className),
              color: getColorForClass(className)
            }))
          
          console.log('Filtrelenmiş sınıflar:', uniqueClasses)
          setMaterialClasses(uniqueClasses || [])
        }
      } catch (error) {
        console.error('Veri yüklenirken hata:', error)
      }
    }

    fetchData()
  }, [supabase])

  // Sınıf seçildiğinde grupları çek
  const fetchMaterialGroups = async (materialClass: string) => {
    try {
      const { data: groupsData, error } = await supabase
        .from('all_materials')
        .select('group')
        .eq('class', materialClass)
        .not('group', 'is', null)
        .not('group', 'eq', '')
        .order('group')

      if (error) {
        console.error('Malzeme grupları yüklenirken hata:', error)
      } else {
        console.log('Raw group data:', groupsData)
        
        // Farklı group değerlerini filtrele - sadece string değerleri al
        const groupNames = groupsData
          ?.map(item => item.group)
          ?.filter(grp => typeof grp === 'string' && grp.trim() !== '') || []
          
        console.log('Filtered group names:', groupNames)
        console.log('Group names length:', groupNames.length)
        
        const uniqueGroupNames = Array.from(new Set(groupNames))
          .filter(Boolean)
          .sort()
        
        console.log('Unique group names:', uniqueGroupNames)
        console.log('Unique group names length:', uniqueGroupNames.length)
          
        const uniqueGroups = uniqueGroupNames.map((groupName, index) => ({
            id: index + 1,
            name: groupName,
            description: `${groupName} grubu malzemeler`,
            icon: getIconForGroup(groupName),
            color: getColorForGroup(groupName)
          }))
        
        console.log('Malzeme grupları başarıyla yüklendi:', uniqueGroups)
        setMaterialGroups(uniqueGroups || [])
      }
    } catch (error) {
      console.error('Malzeme grupları yüklenirken hata:', error)
    }
  }

  // Grup seçildiğinde malzeme öğelerini çek
  const fetchMaterialItems = async (materialClass: string, materialGroup: string) => {
    try {
      const { data: itemsData, error } = await supabase
        .from('all_materials')
        .select('item_name')
        .eq('class', materialClass)
        .eq('group', materialGroup)
        .not('item_name', 'is', null)
        .not('item_name', 'eq', '')
        .order('item_name')

      if (error) {
        console.error('Malzeme öğeleri yüklenirken hata:', error)
      } else {
        console.log('Raw item data:', itemsData)
        
        // Farklı item_name değerlerini filtrele - sadece string değerleri al
        const itemNames = itemsData
          ?.map(item => item.item_name)
          ?.filter(itm => typeof itm === 'string' && itm.trim() !== '') || []
          
        const uniqueItems = Array.from(new Set(itemNames))
          .filter(Boolean)
          .sort()
          .map((itemName, index) => {
            return {
              id: index + 1,
              name: itemName,
              description: `${materialGroup} grubundan ${itemName}`,
              unit: 'adet' // Varsayılan birim
            }
          })
        
        console.log('Malzeme öğeleri başarıyla yüklendi:', uniqueItems)
        setMaterialItems(uniqueItems || [])
      }
    } catch (error) {
      console.error('Malzeme öğeleri yüklenirken hata:', error)
    }
  }

  // Türkçe karakter normalizasyonu ve sinonim mapping
  const normalizeTurkish = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
  }

  // Sayısal pattern normalizasyonu
  const normalizeNumericPatterns = (text: string): string[] => {
    const variants = [text]
    
    // Sayı formatlarını normalize et
    let normalized = text
    
    // "2 40" -> "240", "2*40", "2-40", "2x40"
    normalized = normalized.replace(/(\d+)\s+(\d+)/g, (match, num1, num2) => {
      variants.push(`${num1}*${num2}`)
      variants.push(`${num1}-${num2}`)
      variants.push(`${num1}x${num2}`)
      variants.push(`${num1}X${num2}`)
      return `${num1}${num2}`
    })
    
    // "240" -> "2*40", "2 40", "2-40"
    const numberMatches = text.match(/\b(\d{2,})\b/g)
    if (numberMatches) {
      numberMatches.forEach(num => {
        if (num.length >= 3) {
          // 3 haneli sayıları farklı şekillerde böl
          for (let i = 1; i < num.length; i++) {
            const part1 = num.substring(0, i)
            const part2 = num.substring(i)
            if (part1 !== '0' && part2 !== '0') {
              variants.push(text.replace(num, `${part1}*${part2}`))
              variants.push(text.replace(num, `${part1} ${part2}`))
              variants.push(text.replace(num, `${part1}-${part2}`))
              variants.push(text.replace(num, `${part1}x${part2}`))
            }
          }
        }
      })
    }
    
    // Teknik terimler için kısaltmalar
    normalized = normalized
      .replace(/\bamp\b/gi, 'amper')
      .replace(/\bamper\b/gi, 'amp')
      .replace(/\bma\b/gi, 'miliamper')
      .replace(/\bmiliamper\b/gi, 'ma')
      .replace(/\brcd\b/gi, 'kaçak akım rölesi')
      .replace(/\bkaçak akım rölesi\b/gi, 'rcd')
    
    variants.push(normalized)
    
    return Array.from(new Set(variants.filter(v => v.trim())))
  }

  // Malzeme terimleri için sinonim mapping
  const expandQueryWithSynonyms = (query: string): string[] => {
    const synonyms: Record<string, string[]> = {
      'boru': ['tube', 'pipe', 'kanal'],
      'kangal': ['coil', 'spiral', 'rulo'],
      'kablo': ['cable', 'wire', 'tel'],
      'vida': ['screw', 'bolt', 'civata'],
      'anahtar': ['key', 'wrench', 'alyan'],
      'alyan': ['allen', 'hex', 'altıgen'],
      'tornavida': ['screwdriver', 'torx'],
      'testere': ['saw', 'blade', 'kesmek'],
      'matkap': ['drill', 'bit', 'uç'],
      'boya': ['paint', 'renk', 'boyar'],
      'fırça': ['brush', 'roller'],
      'silikon': ['sealant', 'mastik', 'conta'],
      'elektrik': ['electric', 'elektronik', 'power'],
      'mekanik': ['mechanical', 'makine', 'motor'],
      'amp': ['amper', 'ampere'],
      'amper': ['amp', 'ampere'],
      'ma': ['miliamper', 'milliamp'],
      'rcd': ['kaçak akım rölesi', 'residual current device'],
      'mcb': ['minyatür devre kesici', 'miniature circuit breaker'],
      'eaton': ['schneider', 'abb', 'siemens'], // Marka alternatifleri
    }
    
    // Önce sayısal pattern'leri normalize et
    const numericVariants = normalizeNumericPatterns(query)
    const allQueries: string[] = []
    
    numericVariants.forEach(variant => {
      allQueries.push(variant)
      
      const words = variant.toLowerCase().split(/\s+/)
      
      // Her kelime için sinonim varsa ekle
      words.forEach(word => {
        const normalizedWord = normalizeTurkish(word)
        
        // Direct synonym lookup
        if (synonyms[normalizedWord]) {
          synonyms[normalizedWord].forEach(synonym => {
            allQueries.push(variant.replace(new RegExp(word, 'gi'), synonym))
          })
        }
        
        // Reverse lookup - sinonim listelerinde bu kelime var mı?
        Object.entries(synonyms).forEach(([mainWord, syns]) => {
          if (syns.includes(normalizedWord)) {
            allQueries.push(variant.replace(new RegExp(word, 'gi'), mainWord))
            syns.forEach(syn => {
              if (syn !== normalizedWord) {
                allQueries.push(variant.replace(new RegExp(word, 'gi'), syn))
              }
            })
          }
        })
      })
    })
    
    return Array.from(new Set(allQueries)) // Remove duplicates
  }

  // Sayısal pattern similarity check
  const checkNumericSimilarity = (text: string, query: string): number => {
    const textVariants = normalizeNumericPatterns(text)
    const queryVariants = normalizeNumericPatterns(query)
    
    let maxScore = 0
    
    // Cross-check all variants
    textVariants.forEach(textVar => {
      queryVariants.forEach(queryVar => {
        if (textVar.toLowerCase() === queryVar.toLowerCase()) {
          maxScore = Math.max(maxScore, 100)
        } else if (textVar.toLowerCase().includes(queryVar.toLowerCase())) {
          maxScore = Math.max(maxScore, 90)
        } else if (queryVar.toLowerCase().includes(textVar.toLowerCase())) {
          maxScore = Math.max(maxScore, 85)
        }
      })
    })
    
    return maxScore
  }

  // Similarity scoring için yardımcı fonksiyon
  const calculateSimilarity = (text: string, query: string): number => {
    const textLower = text.toLowerCase()
    const queryLower = query.toLowerCase()
    
    // Normalized versions for Turkish character matching
    const textNormalized = normalizeTurkish(text)
    const queryNormalized = normalizeTurkish(query)
    
    // Check numeric pattern similarity first
    const numericScore = checkNumericSimilarity(text, query)
    if (numericScore > 0) {
      return numericScore
    }
    
    // Exact match
    if (textLower === queryLower) return 100
    if (textNormalized === queryNormalized) return 95
    
    // Contains full query
    if (textLower.includes(queryLower)) return 90
    if (textNormalized.includes(queryNormalized)) return 85
    
    // Word match scoring
    const textWords = textLower.split(/\s+/)
    const queryWords = queryLower.split(/\s+/)
    const textWordsNormalized = textNormalized.split(/\s+/)
    const queryWordsNormalized = queryNormalized.split(/\s+/)
    
    let score = 0
    let matchedWords = 0
    
    for (let i = 0; i < queryWords.length; i++) {
      const queryWord = queryWords[i]
      const queryWordNormalized = queryWordsNormalized[i]
      let bestWordScore = 0
      
      for (let j = 0; j < textWords.length; j++) {
        const textWord = textWords[j]
        const textWordNormalized = textWordsNormalized[j]
        
        if (textWord === queryWord) {
          bestWordScore = 100
          break
        } else if (textWordNormalized === queryWordNormalized) {
          bestWordScore = Math.max(bestWordScore, 95)
        } else {
          // Check numeric pattern similarity for individual words
          const wordNumericScore = checkNumericSimilarity(textWord, queryWord)
          if (wordNumericScore > 0) {
            bestWordScore = Math.max(bestWordScore, wordNumericScore)
          } else if (textWord.includes(queryWord)) {
            bestWordScore = Math.max(bestWordScore, 80)
          } else if (textWordNormalized.includes(queryWordNormalized)) {
            bestWordScore = Math.max(bestWordScore, 75)
          } else if (queryWord.includes(textWord)) {
            bestWordScore = Math.max(bestWordScore, 70)
          } else if (queryWordNormalized.includes(textWordNormalized)) {
            bestWordScore = Math.max(bestWordScore, 65)
          } else {
            // Simple character similarity
            const commonChars = queryWord.split('').filter(char => textWord.includes(char)).length
            const similarity = (commonChars / Math.max(queryWord.length, textWord.length)) * 50
            bestWordScore = Math.max(bestWordScore, similarity)
          }
        }
      }
      
      if (bestWordScore > 30) { // Threshold for considering a word match
        score += bestWordScore
        matchedWords++
      }
    }
    
    // Return average score of matched words, penalize unmatched words
    if (matchedWords === 0) return 0
    const averageScore = score / matchedWords
    const completeness = matchedWords / queryWords.length
    
    return averageScore * completeness
  }

  // Gelişmiş arama fonksiyonu
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    try {
      // Sinonim genişletmesi ile sorgu varyasyonları oluştur
      const expandedQueries = expandQueryWithSynonyms(query)
      const searchConditions: string[] = []
      
      // Her genişletilmiş sorgu için arama koşulları ekle
      expandedQueries.forEach(expandedQuery => {
        const queryWords = expandedQuery.trim().toLowerCase().split(/\s+/)
        
        // Full query search
        searchConditions.push(`class.ilike.%${expandedQuery}%`)
        searchConditions.push(`group.ilike.%${expandedQuery}%`)
        searchConditions.push(`item_name.ilike.%${expandedQuery}%`)
        
        // Individual word searches
        for (const word of queryWords) {
          if (word.length >= 2) { // En az 2 karakter
            searchConditions.push(`class.ilike.%${word}%`)
            searchConditions.push(`group.ilike.%${word}%`)
            searchConditions.push(`item_name.ilike.%${word}%`)
          }
        }
      })

      const { data: searchData, error } = await supabase
        .from('all_materials')
        .select('class, group, item_name')
        .or(searchConditions.join(','))
        .not('class', 'is', null)
        .not('group', 'is', null)
        .not('item_name', 'is', null)
        .limit(100) // Daha fazla sonuç çek, sonra filtreleyip sırala

      if (error) {
        console.error('Arama hatası:', error)
      } else {
        // Helper function to count highlights
        const countHighlights = (text: string, query: string): number => {
          if (!query.trim()) return 0
          
          const queryWords = query.toLowerCase().split(/\s+/)
          let totalMatches = 0
          
          queryWords.forEach(word => {
            if (word.length >= 2) {
              const regex = new RegExp(word, 'gi')
              const matches = text.match(regex)
              if (matches) {
                totalMatches += matches.length
              }
            }
          })
          
          return totalMatches
        }

        // Sonuçları score ve highlight count'a göre sırala ve filtrele
        const scoredResults = searchData?.map(item => {
          const itemNameScore = calculateSimilarity(item.item_name, query)
          const groupScore = calculateSimilarity(item.group, query)
          const classScore = calculateSimilarity(item.class, query)
          
          // Combined text for comprehensive scoring
          const combinedText = `${item.item_name} ${item.group} ${item.class}`
          const combinedScore = calculateSimilarity(combinedText, query)
          
          // Count highlights in each field
          const itemNameHighlights = countHighlights(item.item_name, query)
          const groupHighlights = countHighlights(item.group, query)
          const classHighlights = countHighlights(item.class, query)
          const totalHighlights = itemNameHighlights + groupHighlights + classHighlights
          
          // Weighted scoring: item_name is most important
          const baseScore = Math.max(
            itemNameScore * 1.0,
            groupScore * 0.7,
            classScore * 0.5,
            combinedScore * 0.8
          )
          
          // Boost score based on highlight count (more highlights = higher priority)
          const highlightBonus = totalHighlights * 5 // 5 points per highlight
          const finalScore = baseScore + highlightBonus
          
          return {
          class: item.class,
          group: item.group,
          item_name: item.item_name,
            display_text: `${item.item_name} (${item.group} - ${item.class})`,
            score: finalScore,
            highlightCount: totalHighlights
          }
        }) || []
        
        // Minimum score threshold ve sıralama
        const filteredResults = scoredResults
          .filter(result => result.score > 25) // Minimum relevance threshold
          .sort((a, b) => {
            // Primary sort: highlight count (descending)
            if (b.highlightCount !== a.highlightCount) {
              return b.highlightCount - a.highlightCount
            }
            // Secondary sort: score (descending)
            return b.score - a.score
          })
          .slice(0, 15) // En iyi 15 sonucu göster
          
        // Remove duplicates based on item_name
        const uniqueResults = filteredResults.filter((item, index, self) =>
          index === self.findIndex(t => t.item_name === item.item_name)
        )
        
        setSearchResults(uniqueResults)
        setShowSearchResults(true)
      }
    } catch (error) {
      console.error('Arama sırasında hata:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // Arama sonucuna tıklandığında - çoklu seçim desteği
  const handleSearchResultClick = async (result: any) => {
    // Yeni malzeme objesi oluştur
    const newMaterial = {
      id: Math.random().toString(36).substring(2, 15),
      material_class: result.class,
      material_group: result.group,
      material_item_name: result.item_name,
      material_name: result.item_name,
      material_description: '',
      unit: '',
      quantity: '',
      brand: '',
      specifications: '',  // Her malzeme için ayrı teknik özellikler
      purpose: '',         // Her malzeme için ayrı kullanım amacı
      delivery_date: '',   // Her malzeme için ayrı teslimat tarihi
      image_urls: [],
      uploaded_images: [],  // Her malzeme için ayrı yüklenen dosyalar
      image_preview_urls: []  // Her malzeme için ayrı önizleme URL'leri
    }

    // Seçili malzemeler listesine ekle
    setSelectedMaterials(prev => [...prev, newMaterial])

    // Form data'yı güncelle (son seçilen için)
    setFormData(prev => ({
      ...prev,
      material_class: result.class,
      material_group: result.group
    }))

    // İlgili verileri yükle
    await fetchMaterialGroups(result.class)
    await fetchMaterialItems(result.class, result.group)

    // 5. adıma git (malzeme detayları)
    setCurrentStep(5)
    
    // Son eklenen malzemeyi seç
    setCurrentMaterialIndex(selectedMaterials.length)
    
    // Arama sonuçlarını gizle
    setShowSearchResults(false)
    setSearchQuery('')
  }

  // Arama input değişikliği
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    
    // Önceki timeout'u temizle
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Yeni timeout ayarla
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  // Yeni malzeme oluşturma fonksiyonu
  const handleCreateMaterial = async () => {
    console.log('🚀 handleCreateMaterial başlatıldı')
    console.log('📋 Form data:', createMaterialData)
    
    if (!createMaterialData.class || !createMaterialData.group || !createMaterialData.item_name) {
      console.log('❌ Eksik alan tespit edildi:', {
        class: createMaterialData.class,
        group: createMaterialData.group,
        item_name: createMaterialData.item_name
      })
      showToast('Lütfen tüm alanları doldurun', 'error')
      return
    }

    setIsCreatingMaterial(true)
    try {
      console.log('📡 Server action import ediliyor...')
      // Server action'ı kullan
      const { createMaterialItem } = await import('@/lib/actions')
      
      console.log('📤 Server action çağrılıyor:', {
        class: createMaterialData.class,
        group: createMaterialData.group,
        item_name: createMaterialData.item_name
      })
      
      const result = await createMaterialItem({
        class: createMaterialData.class,
        group: createMaterialData.group,
        item_name: createMaterialData.item_name
      })

      console.log('📥 Server action sonucu:', result)

      if (!result.success) {
        console.log('❌ Server action hatası:', result.error)
        showToast(`Hata: ${result.error}`, 'error')
        return
      }

      console.log('✅ Malzeme başarıyla oluşturuldu:', result.data)
      showToast('Yeni malzeme başarıyla oluşturuldu!', 'success')
      
      // Yeni malzeme objesi oluştur
      const newMaterial = {
        id: Math.random().toString(36).substring(2, 15),
        material_class: createMaterialData.class,
        material_group: createMaterialData.group,
        material_item_name: createMaterialData.item_name,
        material_name: createMaterialData.item_name,
        material_description: '',
        unit: '',
        quantity: '',
        brand: '',
        specifications: '',
        purpose: '',         // Her malzeme için ayrı kullanım amacı
        delivery_date: '',   // Her malzeme için ayrı teslimat tarihi
        image_urls: [],
        uploaded_images: [],
        image_preview_urls: []
      }

      // Seçili malzemeler listesine ekle
      setSelectedMaterials(prev => [...prev, newMaterial])

      // Form data'yı güncelle
      setFormData(prev => ({
        ...prev,
        material_class: createMaterialData.class,
        material_group: createMaterialData.group
      }))

      // Modal'ı kapat ve state'i temizle
      setShowCreateMaterialModal(false)
      setCreateMaterialData({ class: '', group: '', item_name: '' })
      
      // Arama sonuçlarını gizle
      setShowSearchResults(false)
      setSearchQuery('')

      // 5. adıma git (malzeme detayları)
      setCurrentStep(5)
      
      // Son eklenen malzemeyi seç
      setCurrentMaterialIndex(selectedMaterials.length)
      
    } catch (error) {
      console.error('💥 Malzeme oluşturma sırasında beklenmeyen hata:', error)
      showToast('Beklenmeyen bir hata oluştu', 'error')
    } finally {
      setIsCreatingMaterial(false)
    }
  }

  // Yeni malzeme modal'ını aç
  const openCreateMaterialModal = () => {
    // Eğer arama query'si varsa, onu item_name olarak ön-doldur
    setCreateMaterialData(prev => ({
      ...prev,
      item_name: searchQuery || ''
    }))
    setShowCreateMaterialModal(true)
  }

  // Modal'da sınıf seçildiğinde grupları yükle
  useEffect(() => {
    if (createMaterialData.class && showCreateMaterialModal) {
      console.log('Modal: Fetching groups for class:', createMaterialData.class)
      fetchMaterialGroups(createMaterialData.class)
      // Sınıf değiştiğinde group'u sıfırla
      setCreateMaterialData(prev => ({ ...prev, group: '' }))
    }
  }, [createMaterialData.class, showCreateMaterialModal])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files || selectedMaterials.length === 0) return

    const currentMaterial = selectedMaterials[currentMaterialIndex]
    const currentImages = currentMaterial.uploaded_images || []
    const newFiles = Array.from(files).slice(0, 3 - currentImages.length) // Max 3 resim per material
    const newPreviewUrls: string[] = []

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
      }
    })

    // Seçili malzemeyi güncelle
    const updatedMaterials = [...selectedMaterials]
    updatedMaterials[currentMaterialIndex] = {
      ...updatedMaterials[currentMaterialIndex],
      uploaded_images: [...currentImages, ...newFiles],
      image_preview_urls: [...(currentMaterial.image_preview_urls || []), ...newPreviewUrls]
    }
    setSelectedMaterials(updatedMaterials)
  }

  const removeImage = (index: number) => {
    if (selectedMaterials.length === 0) return

    const currentMaterial = selectedMaterials[currentMaterialIndex]
    const imageUrls = currentMaterial.image_preview_urls || []
    
    // Clean up URL object
    if (imageUrls[index]) {
      URL.revokeObjectURL(imageUrls[index])
    }
    
    // Seçili malzemeyi güncelle
    const updatedMaterials = [...selectedMaterials]
    updatedMaterials[currentMaterialIndex] = {
      ...updatedMaterials[currentMaterialIndex],
      uploaded_images: (currentMaterial.uploaded_images || []).filter((_, i) => i !== index),
      image_preview_urls: imageUrls.filter((_, i) => i !== index)
    }
    setSelectedMaterials(updatedMaterials)
  }

  const triggerCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Arka kamera
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleImageUpload(target.files)
    }
    input.click()
  }

  const triggerGallerySelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleImageUpload(target.files)
    }
    input.click()
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.construction_site || userSite // Kullanıcının şantiyesi varsa geçerli
      case 2:
        return formData.material_class // Malzeme sınıfı seçimi zorunlu
      case 3:
        return formData.material_group // Malzeme grubu seçimi zorunlu
      case 4:
        return selectedMaterials.length > 0 // En az bir malzeme seçilmeli
      case 5:
        // Tüm seçili malzemeler için zorunlu alanlar dolu olmalı (material_name otomatik dolu olduğu için kontrol edilmez)
        return selectedMaterials.length > 0 && selectedMaterials.every(material => 
          material.unit && material.quantity && material.delivery_date
        )
      case 6:
        return true // Step 6 artık sadece özet gösteriyor, purpose her malzemede ayrı kontrol ediliyor
      case 7:
        return isFormValid()
      default:
        return false
    }
  }

  const isFormValid = () => {
    return (formData.construction_site || userSite) && 
           selectedMaterials.length > 0 &&
           selectedMaterials.every(material => 
             material.unit && material.quantity && material.delivery_date
           )
  }

  const nextStep = () => {
    if (isStepValid(currentStep) && currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Belirli bir malzeme için resimleri storage'a yükle
  const uploadImagesForMaterial = async (materialId: string, files: File[]): Promise<string[]> => {
    if (files.length === 0) return []
    
    const uploadedUrls: string[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileExt = file.name.split('.').pop()
      const uniqueId = Math.random().toString(36).substring(2, 15)
      const fileName = `purchase_requests/materials/${materialId}/${Date.now()}_${uniqueId}.${fileExt}`
      
      try {
        console.log('📤 Uploading image for material:', { materialId, fileName, fileSize: file.size, fileType: file.type })
        
        const { data, error } = await supabase.storage
          .from('satinalma')
          .upload(fileName, file)

        if (error) {
          console.error('❌ Storage upload error:', error)
          throw error
        }

        const { data: urlData } = supabase.storage
          .from('satinalma')
          .getPublicUrl(fileName)

        console.log('🔗 Generated URL for material:', urlData.publicUrl)
        uploadedUrls.push(urlData.publicUrl)
      } catch (error) {
        console.error('❌ Resim yükleme hatası:', error)
        throw new Error(`${materialId} malzemesi için resim yüklenirken hata oluştu: ${error}`)
      }
    }
    
    console.log(`✅ Image upload completed for material ${materialId}. URLs:`, uploadedUrls)
    return uploadedUrls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFormValid()) {
      showToast('Lütfen zorunlu alanları doldurun', 'error')
      return
    }

    setLoading(true)
    
    try {
      // Her malzeme için ayrı resim yükleme
      const materialsWithImages = await Promise.all(
        selectedMaterials.map(async (material) => {
          let imageUrls: string[] = []
          
          // Bu malzemeye ait resimleri yükle
          if (material.uploaded_images && material.uploaded_images.length > 0) {
            showToast(`${material.material_name} için resimler yükleniyor...`, 'info')
            imageUrls = await uploadImagesForMaterial(material.id, material.uploaded_images)
          }
          
          return {
            material_name: material.material_name,
            quantity: Math.round(parseFloat(material.quantity)), // Server'da integer bekleniyor, yuvarla
            unit: material.unit,
            brand: material.brand,
            material_class: material.material_class,
            material_group: material.material_group,
            material_item_name: material.material_item_name,
            specifications: material.specifications, // Her malzeme için ayrı teknik özellikler
            purpose: material.purpose, // Her malzeme için ayrı kullanım amacı
            delivery_date: material.delivery_date, // Her malzeme için ayrı teslimat tarihi
            image_urls: imageUrls
          }
        })
      )

      // Yeni multi-material server action'ı kullan
      const result = await createMultiMaterialPurchaseRequest({
        materials: materialsWithImages,
        site_id: formData.construction_site_id || userSite?.id,
        site_name: formData.construction_site || userSite?.name,
        specifications: formData.specifications // Genel ek notlar
      })

      if (!result.success) {
        showToast(`Hata: ${result.error}`, 'error')
        setLoading(false)
        return
      }

      showToast(result.message || 'Talep başarıyla oluşturuldu!', 'success')
      
      // Requests sayfasına yönlendir
      router.push('/dashboard/requests')
      
    } catch (error) {
      console.error('Talep oluşturma hatası:', error)
      if (error instanceof Error && error.message.includes('Resim yüklenirken')) {
        showToast(error.message, 'error')
      } else {
        showToast('Talep oluşturulurken bir hata oluştu.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  // Search Bar Component
  const renderSearchBar = () => {
    if (currentStep < 2 || currentStep > 5) return null

    return (
      <Card className="border-none shadow-none">
          <div className="flex items-center gap-3 order-2 lg:order-1">
                  {currentStep > 1 && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="h-0 lg:h-12 px-3 lg:px-6 rounded-lg lg:rounded-xl font-medium bg-white/30 border-white/40 hover:bg-white/50 text-sm lg:text-base flex-1 lg:flex-none"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Önceki
                    </Button>
                  )}
                </div>
        <CardContent className="p-2 lg:p-2">
          <div className="relative search-container z-20">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Malzeme ara... (örn: boru kangal, 240 amp, 2*40 rcd, elektrik kablosu)"
                className="flex-1 h-10 lg:h-10 rounded-xl lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-base lg:text-base"
              />
              {isSearching && (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-[9999]">
                {searchResults.map((result, index) => {
                  // Relevance indicator based on score
                  const getRelevanceColor = (score: number) => {
                    if (score >= 80) return 'bg-green-500'
                    if (score >= 60) return 'bg-yellow-500'
                    if (score >= 40) return 'bg-orange-500'
                    return 'bg-gray-400'
                  }
                  
                  const getRelevanceText = (score: number) => {
                    if (score >= 80) return 'Yüksek eşleşme'
                    if (score >= 60) return 'İyi eşleşme'
                    if (score >= 40) return 'Kısmi eşleşme'
                    return 'Düşük eşleşme'
                  }

                  // Text highlighting function with match counting
                  const highlightText = (text: string, query: string) => {
                    if (!query.trim()) return { html: text, matchCount: 0 }
                    
                    const queryWords = query.toLowerCase().split(/\s+/)
                    let highlightedText = text
                    let totalMatches = 0
                    
                    queryWords.forEach(word => {
                      if (word.length >= 2) {
                        const regex = new RegExp(`(${word})`, 'gi')
                        const matches = text.match(regex)
                        if (matches) {
                          totalMatches += matches.length
                          highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
                        }
                      }
                    })
                    
                    return { html: highlightedText, matchCount: totalMatches }
                  }

                  // Calculate highlight counts for better sorting
                  const itemNameHighlight = highlightText(result.item_name, searchQuery)
                  const groupHighlight = highlightText(result.group, searchQuery)
                  const classHighlight = highlightText(result.class, searchQuery)
                  const totalHighlights = itemNameHighlight.matchCount + groupHighlight.matchCount + classHighlight.matchCount

                  return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSearchResultClick(result)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div 
                            className="font-medium text-gray-900 text-sm truncate"
                            dangerouslySetInnerHTML={{ 
                              __html: itemNameHighlight.html
                            }}
                          />
                    <div className="text-xs text-gray-500 mt-1">
                            <span 
                              dangerouslySetInnerHTML={{ 
                                __html: groupHighlight.html
                              }} 
                            />
                            {' → '}
                            <span 
                              dangerouslySetInnerHTML={{ 
                                __html: classHighlight.html
                              }} 
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end ml-3 flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full ${getRelevanceColor(result.score || 0)}`} />
                          <div className="text-xs text-gray-400 mt-1 hidden group-hover:block">
                            {getRelevanceText(result.score || 0)}
                            {totalHighlights > 0 && (
                              <div className="text-xs text-blue-600 font-medium">
                                {totalHighlights} eşleşme
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                  </button>
                  )
                })}
                
                {/* Create New Material Button */}
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={openCreateMaterialModal}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-blue-600"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Aradığınızı bulamadınız mı?</div>
                      <div className="text-xs text-blue-500">
                        "{searchQuery}" için yeni malzeme öğesi oluşturun
                      </div>
                    </div>
                  </button>
                </div>
                
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
                  {searchResults.length} sonuç bulundu • Eşleşme sayısına göre sıralanmış
                </div>
              </div>
            )}

            {/* No Results */}
            {showSearchResults && searchResults.length === 0 && !isSearching && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 bg-white rounded-md shadow-xl border border-gray-200 z-[9999]">
                <div className="text-center text-gray-500 text-sm p-4">
                  <Search className="w-8 h-8 mx-auto  text-gray-300" />
                  "{searchQuery}" için sonuç bulunamadı
                </div>
                
                {/* Create New Material Button for No Results */}
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={openCreateMaterialModal}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-blue-600"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Yeni malzeme öğesi oluşturun</div>
                      <div className="text-xs text-blue-500">
                        "{searchQuery}" malzemesini sisteme ekleyin
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-xs text-gray-500">
           
          </p>
        </CardContent>
      </Card>
    )
  }

  const renderStepContent = () => {
    // Kullanıcı şantiye kontrolü tamamlanmadıysa loading göster
    if (isCheckingSite && currentStep === 1) {
      return (
        <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
          <CardContent className="p-6 text-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              <p className="text-gray-600">Yükleniyor...</p>
            </div>
          </CardContent>
        </Card>
      )
    }
    
    switch (currentStep) {
      case 1:
        // Kullanıcının şantiyesi varsa bu adımı hiç gösterme
        if (userSite) {
          return null
        }
        
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader className="">
             
            </CardHeader>
            <CardContent className="p-2 lg:p-6 space-y-3 lg:space-y-4">
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {sites.map((site) => {
                    const hasImage = siteImages[site.name]
                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => {
                          handleInputChange('construction_site', site.name)
                          handleInputChange('construction_site_id', site.id)
                          // Otomatik olarak bir sonraki adıma geç
                          setTimeout(() => {
                            setCurrentStep(2)
                          }, 300)
                        }}
                        className={`
                          aspect-square p-4 rounded-2xl transition-all duration-200 text-sm font-medium relative overflow-hidden
                          ${formData.construction_site === site.name 
                            ? 'shadow-lg ring-4 ring-black/20' 
                            : 'hover:shadow-md'
                          }
                        `}
                        style={{
                          backgroundImage: hasImage ? `url(${siteImages[site.name]})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundColor: hasImage ? 'transparent' : (formData.construction_site === site.name ? '#000000' : 'rgba(255, 255, 255, 0.6)')
                        }}
                      >
                        {/* Resim varsa overlay ekle */}
                        {hasImage && (
                          <div className={`absolute inset-0 transition-all duration-200 ${
                            formData.construction_site === site.name 
                              ? 'bg-black/40' 
                              : 'bg-black/20 hover:bg-black/30'
                          }`} />
                        )}
                        
                        {/* Alt kısım gradient karartma */}
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        
                        {/* İsim alt kısımda */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                          <span className={`text-center leading-tight font-light block text-lg ${
                            hasImage ? 'text-white' : 
                            (formData.construction_site === site.name ? 'text-white' : 'text-gray-700')
                          }`}>
                            {site.name}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader className="pb-3 lg:pb-4">
             
            </CardHeader>
            <CardContent className="p-2 lg:p-6 space-y-3 lg:space-y-4">
              {materialClasses.length === 0 ? (
                <div className="text-center py-8">
                  <Grid3X3 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">Malzeme sınıfları yükleniyor...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Eğer sınıflar görünmüyorsa, sayfayı yenileyin veya konsolu kontrol edin
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-1 lg:gap-3">
                  {materialClasses.map((materialClass) => {
                  const IconComponent = {
                    'Wrench': Wrench,
                    'Ruler': Ruler,
                    'Truck': Truck,
                    'Package2': Package2,
                    'Settings': Settings,
                    'Zap': Zap,
                    'Sparkles': Sparkles,
                    'Shield': Shield,
                    'Palette': Palette
                  }[materialClass.icon] || Package

                  return (
                    <button
                      key={materialClass.id}
                      type="button"
                      onClick={async () => {
                        handleInputChange('material_class', materialClass.name)
                        
                        // Seçilen sınıfa ait grupları çek
                        await fetchMaterialGroups(materialClass.name)
                        
                        // Otomatik olarak bir sonraki adıma geç
                        setTimeout(() => {
                          setCurrentStep(3)
                        }, 300)
                      }}
                      className={`
                        aspect-square p-1 lg:p-6 rounded-lg lg:rounded-2xl transition-all duration-200 text-center border flex flex-col justify-center items-center
                        ${formData.material_class === materialClass.name 
                          ? 'border-gray-800 bg-white/40 shadow-lg' 
                          : 'border-gray-200 bg-white/80 hover:bg-white hover:border-gray-300 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="flex flex-col items-center justify-center text-center h-full">
                        <div 
                          className="p-1 lg:p-3 rounded-lg mb-2"
                          style={{ backgroundColor: materialClass.color + '20' }}
                        >
                          <IconComponent 
                            className="w-5 lg:w-8 h-5 lg:h-8" 
                            style={{ color: materialClass.color }}
                          />
                        </div>
                        <div className="flex flex-col justify-center items-center text-center">
                          <h3 className="font-semibold text-gray-900 text-xs lg:text-base leading-tight mb-1 line-clamp-2">
                            {materialClass.name}
                          </h3>
                          <p className="text-gray-600 text-xs lg:text-sm leading-tight line-clamp-2">
                            {materialClass.description}
                          </p>
                        </div>
                      </div>
                      
                      {formData.material_class === materialClass.name && (
                        <div className="mt-3 flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Seçildi</span>
                        </div>
                      )}
                    </button>
                  )
                })}
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader className="pb-3 lg:pb-4">
             
            </CardHeader>
            <CardContent className="p-2 lg:p-6 space-y-3 lg:space-y-4">
              {materialGroups.length > 0 ? (
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{formData.material_class}</span> sınıfından grup seçiniz:
                    </p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1 lg:gap-3">
                    {materialGroups.map((materialGroup) => {
                      const IconComponent = {
                        'Truck': Truck,
                        'Settings': Settings,
                        'Zap': Zap,
                        'Wrench': Wrench,
                        'Ruler': Ruler,
                        'Package': Package,
                        'Shield': Shield,
                        'Palette': Palette,
                        'Package2': Package2,
                        'Sparkles': Sparkles,
                        'Building2': Building2,
                        'TreePine': TreePine
                      }[materialGroup.icon] || Package

                      return (
                        <button
                          key={materialGroup.id}
                          type="button"
                          onClick={async () => {
                            handleInputChange('material_group', materialGroup.name)
                            
                            // Seçilen gruba ait malzeme öğelerini çek
                            await fetchMaterialItems(formData.material_class, materialGroup.name)
                            
                            // Otomatik olarak bir sonraki adıma geç
                            setTimeout(() => {
                              setCurrentStep(4)
                            }, 300)
                          }}
                          className={`
                            aspect-square p-1 lg:p-4 rounded-lg lg:rounded-2xl transition-all duration-200 text-center border flex flex-col justify-center items-center
                            ${formData.material_group === materialGroup.name 
                              ? 'border-gray-800 bg-white/40 shadow-lg' 
                              : 'border-gray-200 bg-white/80 hover:bg-white hover:border-gray-300 hover:shadow-md'
                            }
                          `}
                        >
                          <div className="flex flex-col items-center justify-center text-center h-full">
                            <div 
                              className="p-1 lg:p-3 rounded-lg mb-2"
                              style={{ backgroundColor: materialGroup.color + '20' }}
                            >
                              <IconComponent 
                                className="w-4 lg:w-6 h-4 lg:h-6" 
                                style={{ color: materialGroup.color }}
                              />
                            </div>
                            <div className="flex flex-col justify-center items-center text-center">
                              <h3 className="font-semibold text-gray-900 text-xs lg:text-sm leading-tight mb-1 line-clamp-2">
                                {materialGroup.name}
                              </h3>
                              <p className="text-gray-600 text-xs leading-tight line-clamp-2">
                                {materialGroup.description}
                              </p>
                            </div>
                          </div>
                          
                          {formData.material_group === materialGroup.name && (
                            <div className="mt-2 flex items-center justify-center gap-1 text-blue-600">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-xs font-medium">Seçildi</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <List className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">Malzeme grupları yükleniyor...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Eğer gruplar görünmüyorsa, önce bir malzeme sınıfı seçtiğinizden emin olun
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="border-none shadow-none">
            <CardHeader className="">
             
            </CardHeader>
            <CardContent className="">
              {materialItems.length > 0 ? (
                <div className="space-y-3">
                  <div className="">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4 mb-2">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{formData.material_group}</span> grubundan malzeme seçiniz:
                      </p>
                      {selectedMaterials.length > 0 && (
                        <Button 
                          type="button"
                          onClick={() => {
                            setCurrentMaterialIndex(0)
                            setCurrentStep(5)
                          }}
                          className="lg:w-auto w-full h-8 lg:h-10 px-4 lg:px-6 rounded-lg lg:rounded-xl font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-sm lg:text-base flex items-center justify-center gap-2"
                        >
                          <span className="lg:hidden">Seçilen {selectedMaterials.length} Malzeme ile</span>
                          <span className="hidden lg:inline">İleri</span>
                          <ArrowLeft className="w-4 h-4 rotate-180" />
                        </Button>
                      )}
                    </div>
                    {selectedMaterials.length > 0 && (
                      <div className="flex justify-start mb-2">
                        <div className="bg-green-100 px-3 py-1 rounded-full">
                          <span className="text-xs font-medium text-green-800">
                            {selectedMaterials.length} malzeme seçildi
                          </span>
                        </div>
                      </div>
                    )}
                    {selectedMaterials.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Birden fazla malzeme seçebilirsiniz. Sonraki adımda her malzeme için detayları gireceksiniz.
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1 lg:gap-3">
                    {/* Yeni Malzeme Oluştur Butonu */}
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMaterialData(prev => ({
                          ...prev,
                          class: formData.material_class,
                          group: formData.material_group,
                          item_name: ''
                        }))
                        setShowCreateMaterialModal(true)
                      }}
                      className="aspect-square p-1 lg:p-4 rounded-lg transition-all duration-200 text-center border border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50/60 hover:border-blue-400 flex flex-col justify-center items-center"
                    >
                      <div className="flex flex-col items-center justify-center text-center h-full">
                        <div className="p-2 bg-blue-100/60 rounded-lg mb-2">
                          <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col justify-center items-center text-center">
                          <h3 className="font-semibold text-blue-700 text-xs leading-tight mb-1 line-clamp-3">
                            Yeni Malzeme Oluştur
                          </h3>
                          <p className="text-blue-600 text-xs leading-tight line-clamp-2">
                            Bulamadınız mı?
                          </p>
                        </div>
                      </div>
                    </button>

                    {materialItems.map((item) => {
                      const isSelected = selectedMaterials.some(mat => mat.material_item_name === item.name)
                      
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              // Malzeme zaten seçili - kaldır
                              setSelectedMaterials(prev => 
                                prev.filter(mat => mat.material_item_name !== item.name)
                              )
                            } else {
                              // Yeni malzeme ekle
                              const newMaterial = {
                                id: Math.random().toString(36).substring(2, 15),
                                material_class: formData.material_class,
                                material_group: formData.material_group,
                                material_item_name: item.name,
                                material_name: item.name,
                                material_description: item.description || '',
                                unit: '',
                                quantity: '',
                                brand: '',
                                specifications: '',
                                purpose: '',         // Her malzeme için ayrı kullanım amacı
                                delivery_date: '',   // Her malzeme için ayrı teslimat tarihi
                                image_urls: [],
                                uploaded_images: [],
                                image_preview_urls: []
                              }
                              setSelectedMaterials(prev => [...prev, newMaterial])
                            }
                          }}
                          className={`
                            aspect-square p-1 lg:p-4 rounded-lg transition-all duration-200 text-center border flex flex-col justify-center items-center relative
                            ${isSelected 
                              ? 'border-green-600 bg-green-50/60 shadow-lg' 
                              : 'border-gray-200 bg-white/80 hover:bg-white hover:border-gray-300 hover:shadow-md'
                            }
                          `}
                        >
                          <div className="flex flex-col items-center justify-center text-center h-full">
                            <div className={`p-2 rounded-lg mb-2 ${isSelected ? 'bg-green-100' : 'bg-gray-100'}`}>
                              <Package className={`w-4 h-4 ${isSelected ? 'text-green-600' : 'text-gray-600'}`} />
                            </div>
                            <div className="flex flex-col justify-center items-center text-center">
                              <h3 className="font-semibold text-gray-900 text-xs leading-tight mb-1 line-clamp-3">
                                {item.name}
                              </h3>
                            </div>
                            
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  
                  {/* Seçilen Malzemelerle İlerle Butonu */}
                  {selectedMaterials.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/30">
                      <Button
                        type="button"
                        onClick={() => {
                          setCurrentMaterialIndex(0)
                          setCurrentStep(5)
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl font-medium"
                      >
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Seçilen {selectedMaterials.length} Malzeme ile Devam Et
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">Malzemeler yükleniyor...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Eğer malzemeler görünmüyorsa, önce bir malzeme grubu seçtiğinizden emin olun
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 5:
        if (selectedMaterials.length === 0) {
          return (
            <Card className="rounded-xl lg:rounded-2xl bg-white border border-gray-100">
              <CardContent className="p-6 lg:p-12 text-center">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Henüz malzeme seçilmedi</h3>
                <p className="text-gray-500 mb-6">Lütfen önce 4. adımdan malzeme seçin.</p>
                <Button 
                  onClick={() => setCurrentStep(4)}
                  className="bg-black hover:bg-gray-800 text-white rounded-xl h-12 px-8"
                >
                  <ArrowLeft className="w-4 h-4 mr-2 rotate-180" />
                  Malzeme Seçmeye Dön
                </Button>
              </CardContent>
            </Card>
          )
        }

        const currentMaterial = selectedMaterials[currentMaterialIndex]

        return (
          <div className="space-y-4">
            {/* Header Section */}
            <div className="bg-white border border-gray-100 rounded-xl lg:rounded-2xl p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Malzeme Detayları</h3>
                    <p className="text-sm text-gray-500">{currentMaterialIndex + 1} / {selectedMaterials.length} malzeme</p>
                  </div>
                </div>
                
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="h-10 px-4 rounded-xl border-gray-200 hover:bg-gray-50 text-sm font-medium"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Malzeme Ekle
                </Button>
              </div>
              
              {/* Material Navigation Tabs */}
              {selectedMaterials.length > 1 && (
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                  {selectedMaterials.map((material, index) => (
                    <button
                      key={material.id}
                      onClick={() => setCurrentMaterialIndex(index)}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        index === currentMaterialIndex
                          ? 'bg-gray-900 text-white shadow-md'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {material.material_item_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Form Card */}
            <Card className="rounded-xl lg:rounded-2xl bg-white border border-gray-100">
              <CardContent className="p-4 lg:p-8 space-y-6">
                {/* Material Name (Read-only) */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs font-medium text-gray-500 mb-1 block">Malzeme Adı</Label>
                      <p className="text-base font-semibold text-gray-900">{currentMaterial?.material_name || ''}</p>
                    </div>
                  </div>
                </div>

                {/* Quantity & Unit Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      Miktar <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={currentMaterial?.quantity || ''}
                      onChange={(e) => {
                        const updatedMaterials = [...selectedMaterials]
                        updatedMaterials[currentMaterialIndex] = {
                          ...updatedMaterials[currentMaterialIndex],
                          quantity: e.target.value
                        }
                        setSelectedMaterials(updatedMaterials)
                      }}
                      placeholder="0"
                      className="h-12 rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Weight className="w-4 h-4" />
                      Birim <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={currentMaterial?.unit || ''}
                      onChange={(e) => {
                        const updatedMaterials = [...selectedMaterials]
                        updatedMaterials[currentMaterialIndex] = {
                          ...updatedMaterials[currentMaterialIndex],
                          unit: e.target.value
                        }
                        setSelectedMaterials(updatedMaterials)
                      }}
                      placeholder="kg, m³, adet, m²..."
                      className="h-12 rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                    />
                  </div>
                </div>

                {/* Delivery Date */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Ne Zaman Gerekli? <span className="text-red-500">*</span>
                  </Label>
                  <Popover modal={false}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`w-full h-12 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left flex items-center justify-between ${
                          currentMaterial?.delivery_date ? 'text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        <span>
                          {currentMaterial?.delivery_date 
                            ? format(new Date(currentMaterial.delivery_date), 'dd MMMM yyyy', { locale: tr })
                            : 'Tarih seçin'
                          }
                        </span>
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 bg-white shadow-lg border border-gray-200" 
                      align="start" 
                      side="bottom" 
                      sideOffset={8}
                    >
                      <div className="p-3">
                        <CalendarComponent
                          mode="single"
                          selected={currentMaterial?.delivery_date ? new Date(currentMaterial.delivery_date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const updatedMaterials = [...selectedMaterials]
                              updatedMaterials[currentMaterialIndex] = {
                                ...updatedMaterials[currentMaterialIndex],
                                delivery_date: format(date, 'yyyy-MM-dd')
                              }
                              setSelectedMaterials(updatedMaterials)
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          locale={tr}
                          classNames={{
                            day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
                            day_button: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md transition-colors data-[selected=true]:bg-black data-[selected=true]:text-white data-[selected=true]:hover:bg-gray-800 data-[selected=true]:focus:bg-black",
                            day_selected: "!bg-black !text-white hover:!bg-gray-800 focus:!bg-black",
                            day_today: "bg-gray-100 font-semibold",
                            day_outside: "text-gray-400 opacity-50",
                            day_disabled: "text-gray-400 opacity-50",
                            day_hidden: "invisible",
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Brand */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Marka
                  </Label>
                  <Input
                    value={currentMaterial?.brand || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        brand: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="Marka/üretici..."
                    className="h-12 rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                  />
                </div>

                {/* Purpose */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Kullanım Amacı
                  </Label>
                  <Input
                    value={currentMaterial?.purpose || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        purpose: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="Bu malzeme nerede ve nasıl kullanılacak?"
                    className="h-12 rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                  />
                </div>

                {/* Specifications */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Teknik Özellikler
                  </Label>
                  <Textarea
                    value={currentMaterial?.specifications || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        specifications: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="Teknik özellikler, kalite standartları, özel notlar..."
                    className="min-h-[100px] resize-none rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                  />
                </div>

                {/* Image Upload Section */}
                <div className="border-t border-gray-100 pt-6">
                  <Label className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Malzeme Fotoğrafları
                  </Label>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={triggerCameraCapture}
                      disabled={(currentMaterial?.uploaded_images?.length || 0) >= 3}
                      className="h-14 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    >
                      <Camera className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="font-medium">Kamera</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={triggerGallerySelect}
                      disabled={(currentMaterial?.uploaded_images?.length || 0) >= 3}
                      className="h-14 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    >
                      <Upload className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="font-medium">Galeri</span>
                    </Button>
                  </div>

                  {(currentMaterial?.image_preview_urls?.length || 0) > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {(currentMaterial?.image_preview_urls || []).map((url, index) => (
                        <div key={index} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/70 hover:bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm text-gray-500">Maksimum 3 fotoğraf yükleyebilirsiniz</p>
                    </div>
                  )}
                </div>

                {/* Material Navigation */}
                {selectedMaterials.length > 1 && (
                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentMaterialIndex(Math.max(0, currentMaterialIndex - 1))}
                      disabled={currentMaterialIndex === 0}
                      className="flex-1 h-12 rounded-xl"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Önceki
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentMaterialIndex(Math.min(selectedMaterials.length - 1, currentMaterialIndex + 1))}
                      disabled={currentMaterialIndex === selectedMaterials.length - 1}
                      className="flex-1 h-12 rounded-xl"
                    >
                      Sonraki
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 6:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white border border-gray-100">
            <CardHeader className="border-b border-gray-100 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">Kullanım & Zamanlama</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{selectedMaterials.length} malzeme için özet bilgiler</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
              {/* Malzeme Özet Kartları */}
              <div className="space-y-3">
                {selectedMaterials.map((material, index) => (
                  <div key={material.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">{index + 1}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{material.material_name}</h4>
                          <p className="text-sm text-gray-500">{material.quantity} {material.unit}</p>
                        </div>
                        
                        {material.purpose && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-start gap-2">
                              <Target className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 mb-1">Kullanım Amacı</p>
                                <p className="text-sm text-gray-900">{material.purpose}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {material.delivery_date && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 text-gray-400" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500">Gerekli Tarih</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {new Date(material.delivery_date).toLocaleDateString('tr-TR', { 
                                    day: 'numeric', 
                                    month: 'long', 
                                    year: 'numeric' 
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ek Notlar */}
              <div className="border-t border-gray-100 pt-6">
                <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Genel Talep Notları (Opsiyonel)
                </Label>
                <Textarea
                  value={formData.specifications}
                  onChange={(e) => handleInputChange('specifications', e.target.value)}
                  placeholder="Talep ile ilgili ek notlar, özel talimatlar..."
                  className="min-h-[120px] resize-none rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                />
              </div>
            </CardContent>
          </Card>
        )

      case 7:
        return (
          <div className="space-y-4">
            {/* Header with Submit Button */}
            <Card className="rounded-xl lg:rounded-2xl bg-white border border-gray-100">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Talep Özeti</h3>
                      <p className="text-sm text-gray-500 mt-1">Son kontrol ve gönderim</p>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={loading || !isFormValid()}
                    className="w-full lg:w-auto h-12 lg:h-12 px-8 rounded-xl font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-3" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Talebi Gönder
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="rounded-xl bg-white border border-gray-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-gray-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500">Şantiye</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{userSite?.name || formData.construction_site}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="rounded-xl bg-white border border-gray-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">Toplam Malzeme</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedMaterials.length} adet</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="rounded-xl bg-white border border-gray-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500">Fotoğraflar</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedMaterials.reduce((sum, m) => sum + (m.uploaded_images?.length || 0), 0)} adet
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Materials List */}
            <Card className="rounded-xl lg:rounded-2xl bg-white border border-gray-100">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="text-base font-semibold text-gray-900">Malzeme Listesi</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {selectedMaterials.map((material, index) => (
                    <div key={material.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-gray-50/50">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 mb-1">{material.material_name}</h4>
                            <p className="text-sm text-gray-500">{material.material_group} → {material.material_class}</p>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xl font-bold text-gray-900">{material.quantity}</p>
                          <p className="text-sm text-gray-500">{material.unit}</p>
                        </div>
                      </div>
                      
                      {/* Details Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                        {material.brand && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="text-xs font-medium text-gray-500 mb-1">Marka</p>
                            <p className="text-sm font-medium text-gray-900">{material.brand}</p>
                          </div>
                        )}
                        {material.material_item_name && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="text-xs font-medium text-gray-500 mb-1">Malzeme Kodu</p>
                            <p className="text-sm font-medium text-gray-900">{material.material_item_name}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Purpose & Date */}
                      {(material.purpose || material.delivery_date) && (
                        <div className="space-y-3 mb-4">
                          {material.purpose && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start gap-2">
                                <Target className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Kullanım Amacı</p>
                                  <p className="text-sm text-gray-900">{material.purpose}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {material.delivery_date && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-gray-400" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-500">Gerekli Tarih</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(material.delivery_date).toLocaleDateString('tr-TR', { 
                                      day: 'numeric', 
                                      month: 'long', 
                                      year: 'numeric' 
                                    })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Specifications */}
                      {material.specifications && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                          <div className="flex items-start gap-2">
                            <Settings className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-500 mb-1">Teknik Özellikler</p>
                              <p className="text-sm text-gray-900">{material.specifications}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Images */}
                      {(material.image_preview_urls?.length || 0) > 0 && (
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {material.uploaded_images?.length} Fotoğraf
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {(material.image_preview_urls || []).map((url, imgIndex) => (
                              <div key={imgIndex} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                  src={url}
                                  alt={`${material.material_name} ${imgIndex + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bottom Submit Button */}
            <Card className="border-none shadow-none">
              <CardContent className="p-6">
                <Button 
                  type="submit" 
                  disabled={loading || !isFormValid()}
                  className="w-full h-14 px-8 rounded-xl font-semibold bg-black hover:bg-gray-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mr-3" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Talebi Gönder
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-300 mt-3">
                  {selectedMaterials.length} malzeme ile talep oluşturulacak
                </p>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
    {/* Create New Material Modal */}
    <Dialog open={showCreateMaterialModal} onOpenChange={setShowCreateMaterialModal}>
      <DialogContent className="sm:max-w-[550px] bg-white border border-gray-200 shadow-2xl">
        {/* Content */}
        <div className="relative z-10">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
              
              Yeni Malzeme Öğesi Oluştur
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-2">
              Aradığınız malzemeyi sisteme ekleyin ve hemen kullanmaya başlayın
            </p>
          </DialogHeader>
          
          <div className="space-y-6 py-2">
            {/* Class Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-gray-600" />
                Malzeme Sınıfı *
              </Label>
              <Select 
                value={createMaterialData.class} 
                onValueChange={(value) => setCreateMaterialData(prev => ({ ...prev, class: value }))}
              >
                <SelectTrigger className="w-full h-12 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 focus:ring-2 focus:ring-gray-500/30 focus:border-gray-500 text-base">
                  <SelectValue placeholder="Sınıf seçin veya yeni sınıf adı yazın..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-2xl">
                  {materialClasses.map((cls) => (
                    <SelectItem 
                      key={cls.id} 
                      value={cls.name}
                      className="hover:bg-gray-50/80 focus:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        {cls.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <List className="w-4 h-4 text-gray-600" />
                Malzeme Grubu *
              </Label>
              <Select 
                value={createMaterialData.group} 
                onValueChange={(value) => setCreateMaterialData(prev => ({ ...prev, group: value }))}
                disabled={!createMaterialData.class}
              >
                <SelectTrigger className={`w-full h-12 bg-white border border-gray-300 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-gray-500/30 focus:border-gray-500 text-base ${
                  !createMaterialData.class 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-gray-50'
                }`}>
                  <SelectValue placeholder="Grup seçin veya yeni grup adı yazın..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-2xl">
                  {materialGroups.length === 0 ? (
                    <SelectItem value="no-groups" disabled>
                      Grup bulunamadı
                    </SelectItem>
                  ) : (
                    materialGroups.map((group) => (
                      <SelectItem 
                        key={group.id} 
                        value={group.name}
                        className="hover:bg-gray-50/80 focus:bg-gray-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                          {group.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {!createMaterialData.class ? (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  <Settings className="w-3 h-3" />
                  Önce bir sınıf seçin
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  {materialGroups.length} mevcut grup bulundu
                </div>
              )}
            </div>

            {/* Item Name Input */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-600" />
                Malzeme Adı *
              </Label>
              <Input
                value={createMaterialData.item_name}
                onChange={(e) => setCreateMaterialData(prev => ({ ...prev, item_name: e.target.value }))}
                placeholder="Malzeme adını girin..."
                className="w-full h-12 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 focus:ring-2 focus:ring-gray-500/30 focus:border-gray-500 placeholder:text-gray-500 text-base"
              />
            </div>
          </div>

          <DialogFooter className="pt-6 gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateMaterialModal(false)}
              disabled={isCreatingMaterial}
              className="h-12 px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-200"
            >
              İptal
            </Button>
            <Button 
              onClick={handleCreateMaterial}
              disabled={isCreatingMaterial || !createMaterialData.class || !createMaterialData.group || !createMaterialData.item_name}
              className="h-12 px-6 bg-black hover:bg-gray-800 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingMaterial ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  
                  Oluştur
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    <div className="min-h-screen ">
    <div className="px-0 lg:px-2 xl:px-4 pb-4 space-y-2 lg:space-y-2">
    <div className="mt-3 lg:mt-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleBack}
              className="bg-white/20 border border-gray-200 backdrop-blur-lg hover:bg-white/30 rounded-lg lg:rounded-xl text-sm h-8 lg:h-auto px-4 py-2 lg:px-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anasayfa
            </Button>
          </div>
      {/* Header */}
      <div className="pt-2 lg:pt-0">
        <div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-normal text-gray-900">
              {(userSite?.name || formData.construction_site) && (
                <span className="text-gray-500">{userSite?.name || formData.construction_site} için </span>
              )}
              Yeni Satın Alma Talebi
            </h1>
            <p className="text-gray-600 mt-1 lg:mt-2 text-sm lg:text-lg font-light">Malzeme ve hizmet taleplerini oluşturun</p>
          </div>
         
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/20 rounded-xl lg:rounded-2xl ">
        <div className=" ">
          <h3 className="text-base lg:text-lg font-semibold text-gray-900">Adım {currentStep} / {steps.length}</h3>
        </div>



        {/* Current Step Title */}
        <div className="text-center">
          <h4 className="text-lg lg:text-xl font-bold text-gray-900">{steps[currentStep - 1]?.title}</h4>
          <div className="lg:hidden text-sm text-gray-600 ">
            %{Math.round((currentStep / steps.length) * 100)} tamamlandı
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 lg:h-2 mt-2 lg:mt-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 lg:h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div>
        <div className="w-full">
          <form onSubmit={handleSubmit} className="space-y-1 lg:space-y-2">
            {/* Search Bar */}
            {renderSearchBar()}
            
            {/* Step Content */}
            <div className="min-h-[250px] lg:min-h-[400px]">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="bg-white/20 lg:backdrop-blur-lg border-0 rounded-xl lg:rounded-2xl p-2 lg:p-6">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0">
                <div className="flex items-center gap-3 order-2 lg:order-1">
                  {currentStep > 1 && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="h-8 lg:h-12 px-3 lg:px-6 rounded-lg lg:rounded-xl font-medium bg-white/30 border-white/40 hover:bg-white/50 text-sm lg:text-base flex-1 lg:flex-none"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Önceki
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3 order-1 lg:order-2">
                  {currentStep < steps.length && (
                    <Button 
                      type="button"
                      onClick={nextStep}
                      disabled={!isStepValid(currentStep)}
                      className="h-8 lg:h-12 px-4 lg:px-8 rounded-lg lg:rounded-xl font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base flex-1 lg:flex-none"
                    >
                      İleri
                      <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Step Status */}
              <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-white/30">
                <div className="flex items-center justify-center gap-2 text-xs lg:text-sm text-gray-600">
                  {isStepValid(currentStep) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 font-medium">Bu adım tamamlandı</span>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 rounded-full" />
                      <span>Zorunlu alanları doldurun</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
    </div>
    </>
  )
}
