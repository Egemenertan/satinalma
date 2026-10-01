'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ContractDetailsForm } from '@/components/contracts/ContractDetailsForm'
import {
  CONTRACT_CATEGORIES,
  CONTRACT_PROJECT_KEYS,
  contractCategoryLabel,
  contractPartyLabel,
  contractProjectKeyLabel,
} from '@/lib/contract-setup'
import { fetchQuoteComparisonSites, type QuoteComparisonSite } from '@/lib/quoteComparison/projectSites'
import type { ContractCategory, ContractPartyKind } from '@/lib/contracts'
import {
  createSubcontractor,
  fetchContractParties,
  type ContractPartyOption,
} from '@/services/contracts.service'
import { cn } from '@/lib/utils'
import { Building2, Check, Hammer, Plus, Search } from 'lucide-react'

const STEPS = [
  { id: 1, label: 'Taraf' },
  { id: 2, label: 'Projeler' },
  { id: 3, label: 'Tür' },
  { id: 4, label: 'Bilgiler' },
] as const

interface CreateContractWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  presetPartyId?: string
  presetPartyName?: string
  presetPartyKind?: ContractPartyKind
}

function fold(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function CreateContractWizard({
  open,
  onOpenChange,
  onCreated,
  showToast,
  presetPartyId,
  presetPartyName,
  presetPartyKind = 'supplier',
}: CreateContractWizardProps) {
  const [step, setStep] = useState(1)
  const [detailsReady, setDetailsReady] = useState(false)
  const [partyKind, setPartyKind] = useState<ContractPartyKind>('supplier')
  const [partyId, setPartyId] = useState<string | null>(null)
  const [partyName, setPartyName] = useState('')
  const [query, setQuery] = useState('')
  const [siteIds, setSiteIds] = useState<string[]>([])
  const [category, setCategory] = useState<ContractCategory | null>(null)
  const [creatingParty, setCreatingParty] = useState(false)
  const [newPartyOpen, setNewPartyOpen] = useState(false)
  const [newParty, setNewParty] = useState({
    name: '',
    contact_person: '',
    phone: '',
    tax_number: '',
  })

  const { data: suppliers, isLoading: suppliersLoading } = useSWR(
    open ? 'contract-wizard/suppliers' : null,
    () => fetchContractParties('supplier')
  )
  const { data: subcontractors, isLoading: subcontractorsLoading, mutate: mutateSubcontractors } = useSWR(
    open ? 'contract-wizard/subcontractors' : null,
    () => fetchContractParties('subcontractor')
  )
  const { data: projectSites, isLoading: projectsLoading } = useSWR(
    open ? 'contract-wizard/projects' : null,
    fetchQuoteComparisonSites
  )

  const projects = useMemo(() => {
    const byKey = new Map((projectSites || []).map((site) => [site.key, site]))
    return CONTRACT_PROJECT_KEYS.flatMap((key) => {
      const site = byKey.get(key)
      return site ? [site] : []
    })
  }, [projectSites])

  useEffect(() => {
    if (!open) {
      setStep(1)
      setDetailsReady(false)
      setPartyKind('supplier')
      setPartyId(null)
      setPartyName('')
      setQuery('')
      setSiteIds([])
      setCategory(null)
      setNewPartyOpen(false)
      setNewParty({ name: '', contact_person: '', phone: '', tax_number: '' })
      return
    }

    if (presetPartyId) {
      setPartyKind(presetPartyKind)
      setPartyId(presetPartyId)
      setPartyName(presetPartyName || '')
      setStep(2)
    }
  }, [open, presetPartyId, presetPartyKind, presetPartyName])

  const parties = partyKind === 'supplier' ? suppliers || [] : subcontractors || []
  const partiesLoading = partyKind === 'supplier' ? suppliersLoading : subcontractorsLoading

  const filteredParties = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return parties
    return parties.filter((party) =>
      [party.name, party.contact_person, party.phone, party.tax_number]
        .filter(Boolean)
        .some((part) => fold(String(part)).includes(q))
    )
  }, [parties, query])

  const selectParty = (party: ContractPartyOption) => {
    setPartyId(party.id)
    setPartyName(party.name)
  }

  const toggleSite = (siteId: string) => {
    setSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    )
  }

  const goNext = () => {
    if (step === 1 && !partyId) {
      showToast(partyKind === 'supplier' ? 'Bir tedarikçi seçin' : 'Bir taşeron seçin', 'error')
      return
    }
    if (step === 2 && siteIds.length === 0) {
      showToast('En az bir proje seçin', 'error')
      return
    }
    if (step === 3 && !category) {
      showToast('Sözleşme türünü seçin', 'error')
      return
    }
    const next = Math.min(4, step + 1)
    if (next === 4) setDetailsReady(true)
    setStep(next)
  }

  const handleCreateSubcontractor = async () => {
    if (!newParty.name.trim()) {
      showToast('Taşeron adı gerekli', 'error')
      return
    }
    setCreatingParty(true)
    try {
      const created = await createSubcontractor(newParty)
      await mutateSubcontractors()
      setPartyKind('subcontractor')
      setPartyId(created.id)
      setPartyName(created.name)
      setNewPartyOpen(false)
      setNewParty({ name: '', contact_person: '', phone: '', tax_number: '' })
      showToast('Taşeron oluşturuldu', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Taşeron oluşturulamadı', 'error')
    } finally {
      setCreatingParty(false)
    }
  }

  const stepTitle =
    step === 1
      ? 'Sözleşme kiminle?'
      : step === 2
        ? 'Hangi projeleri kapsıyor?'
        : step === 3
          ? 'Sözleşme türü'
          : 'Sözleşme bilgileri'

  const stepHint =
    step === 1
      ? 'Tedarikçi listesinden seçin veya yeni bir taşeron oluşturun.'
      : step === 2
        ? 'Birden fazla proje seçebilirsiniz.'
        : step === 3
          ? 'Kalemlerin hangi alım türüne girdiğini belirleyin.'
          : 'Başlık, bütçe ve kalemleri doldurun.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border sm:border-elegant-gray-200 sm:shadow-2xl"
      >
        <div className="shrink-0 border-b border-elegant-gray-200 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">
                Adım {step} / {STEPS.length}
              </p>
              <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-elegant-black">
                {stepTitle}
              </DialogTitle>
              <p className="mt-1 text-sm text-elegant-gray-600">{stepHint}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-elegant-gray-600 hover:bg-elegant-gray-50"
            >
              Kapat
            </button>
          </div>
          <ol className="mt-4 flex items-center gap-2">
            {STEPS.map((item) => {
              const done = step > item.id
              const current = step === item.id
              return (
                <li key={item.id} className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      done || current
                        ? 'bg-black text-white'
                        : 'bg-elegant-gray-100 text-elegant-gray-500'
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : item.id}
                  </span>
                  <span
                    className={cn(
                      'hidden truncate text-xs font-medium sm:inline',
                      current ? 'text-elegant-black' : 'text-elegant-gray-500'
                    )}
                  >
                    {item.label}
                  </span>
                  {item.id < STEPS.length && (
                    <span className={cn('h-px flex-1', done ? 'bg-black' : 'bg-elegant-gray-200')} />
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        {step !== 4 && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <PartyKindCard
                      active={partyKind === 'supplier'}
                      title="Tedarikçi"
                      description="Kayıtlı tedarikçiler arasından seçin"
                      icon={<Building2 className="h-5 w-5" />}
                      onClick={() => {
                        setPartyKind('supplier')
                        setPartyId(null)
                        setPartyName('')
                        setQuery('')
                        setNewPartyOpen(false)
                      }}
                    />
                    <PartyKindCard
                      active={partyKind === 'subcontractor'}
                      title="Taşeron"
                      description="Mevcut taşeronu seçin veya yeni oluşturun"
                      icon={<Hammer className="h-5 w-5" />}
                      onClick={() => {
                        setPartyKind('subcontractor')
                        setPartyId(null)
                        setPartyName('')
                        setQuery('')
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                        {partyKind === 'supplier' ? 'Tedarikçiler' : 'Taşeronlar'}
                      </p>
                      {partyKind === 'subcontractor' && (
                        <button
                          type="button"
                          onClick={() => setNewPartyOpen((value) => !value)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-elegant-black"
                        >
                          <Plus className="h-4 w-4" />
                          Yeni taşeron
                        </button>
                      )}
                    </div>

                    {partyKind === 'subcontractor' && newPartyOpen && (
                      <div className="space-y-3 rounded-2xl border border-elegant-gray-200 bg-elegant-gray-50 p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Firma adı">
                            <Input
                              value={newParty.name}
                              onChange={(e) => setNewParty((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="Taşeron firma"
                              className="h-11 rounded-xl border-elegant-gray-200 bg-white"
                            />
                          </Field>
                          <Field label="Yetkili">
                            <Input
                              value={newParty.contact_person}
                              onChange={(e) => setNewParty((prev) => ({ ...prev, contact_person: e.target.value }))}
                              placeholder="İsteğe bağlı"
                              className="h-11 rounded-xl border-elegant-gray-200 bg-white"
                            />
                          </Field>
                          <Field label="Telefon">
                            <Input
                              value={newParty.phone}
                              onChange={(e) => setNewParty((prev) => ({ ...prev, phone: e.target.value }))}
                              placeholder="İsteğe bağlı"
                              className="h-11 rounded-xl border-elegant-gray-200 bg-white"
                            />
                          </Field>
                          <Field label="Vergi no">
                            <Input
                              value={newParty.tax_number}
                              onChange={(e) => setNewParty((prev) => ({ ...prev, tax_number: e.target.value }))}
                              placeholder="İsteğe bağlı"
                              className="h-11 rounded-xl border-elegant-gray-200 bg-white"
                            />
                          </Field>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            className="h-11 rounded-2xl bg-black text-white hover:bg-gray-900"
                            onClick={handleCreateSubcontractor}
                            disabled={creatingParty}
                          >
                            {creatingParty ? 'Kaydediliyor...' : 'Taşeronu kaydet'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={partyKind === 'supplier' ? 'Tedarikçi ara' : 'Taşeron ara'}
                        className="h-12 rounded-xl pl-10"
                      />
                    </div>

                    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {partiesLoading ? (
                        <p className="py-8 text-center text-sm text-elegant-gray-500">Yükleniyor...</p>
                      ) : filteredParties.length === 0 ? (
                        <p className="rounded-2xl bg-elegant-gray-50 px-4 py-8 text-center text-sm text-elegant-gray-500">
                          {partyKind === 'supplier'
                            ? 'Eşleşen tedarikçi yok.'
                            : 'Henüz taşeron yok. Yeni taşeron ekleyebilirsiniz.'}
                        </p>
                      ) : (
                        filteredParties.map((party) => (
                          <button
                            key={party.id}
                            type="button"
                            onClick={() => selectParty(party)}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
                              partyId === party.id
                                ? 'border-black bg-black text-white'
                                : 'border-elegant-gray-200 bg-white hover:border-elegant-gray-300'
                            )}
                          >
                            <span>
                              <span className="block text-sm font-semibold">{party.name}</span>
                              <span className={cn(
                                'mt-0.5 block text-xs',
                                partyId === party.id ? 'text-white/70' : 'text-elegant-gray-500'
                              )}>
                                {[party.contact_person, party.phone].filter(Boolean).join(' · ') || 'İletişim bilgisi yok'}
                              </span>
                            </span>
                            {partyId === party.id && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {projectsLoading ? (
                    <p className="col-span-full py-8 text-center text-sm text-elegant-gray-500">Projeler yükleniyor...</p>
                  ) : projects.length === 0 ? (
                    <p className="col-span-full rounded-2xl bg-elegant-gray-50 px-4 py-8 text-center text-sm text-elegant-gray-500">
                      Proje listesi yüklenemedi.
                    </p>
                  ) : (
                    projects.map((project) => {
                      const selected = siteIds.includes(project.id)
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => toggleSite(project.id)}
                          className={cn(
                            'flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition',
                            selected
                              ? 'border-black bg-black text-white'
                              : 'border-elegant-gray-200 bg-white hover:border-elegant-gray-300'
                          )}
                        >
                          <span className="text-sm font-semibold">{contractProjectKeyLabel(project.key)}</span>
                          <span
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full border',
                              selected ? 'border-white bg-white text-black' : 'border-elegant-gray-300'
                            )}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  {CONTRACT_CATEGORIES.map((item) => {
                    const selected = category === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCategory(item.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition',
                          selected
                            ? 'border-black bg-black text-white'
                            : 'border-elegant-gray-200 bg-white hover:border-elegant-gray-300'
                        )}
                      >
                        <span>
                          <span className="block text-base font-semibold">{item.title}</span>
                          <span className={cn('mt-1 block text-sm', selected ? 'text-white/70' : 'text-elegant-gray-500')}>
                            {item.description}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                            selected ? 'border-white bg-white text-black' : 'border-elegant-gray-300'
                          )}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-elegant-gray-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-elegant-gray-200"
                  onClick={() => (step === 1 ? onOpenChange(false) : setStep((value) => value - 1))}
                >
                  {step === 1 ? 'Vazgeç' : 'Geri'}
                </Button>
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-black text-white hover:bg-gray-900 sm:min-w-[180px]"
                  onClick={goNext}
                >
                  {step === 2 && siteIds.length > 0 ? `Devam (${siteIds.length})` : 'Devam'}
                </Button>
              </div>
            </div>
          </>
        )}

        {detailsReady && partyId && category && (
          <div className={step === 4 ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <ContractDetailsForm
              supplierId={partyId}
              supplierName={partyName}
              partyKind={partyKind}
              contractCategory={category}
              siteIds={siteIds}
              cancelLabel="Geri"
              summary={
                <SelectionSummary
                  partyKind={partyKind}
                  partyName={partyName}
                  projects={projects.filter((project) => siteIds.includes(project.id))}
                  category={category}
                />
              }
              onCancel={() => setStep(3)}
              onCreated={() => {
                onOpenChange(false)
                onCreated?.()
              }}
              showToast={showToast}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SelectionSummary({
  partyKind,
  partyName,
  projects,
  category,
}: {
  partyKind: ContractPartyKind
  partyName: string
  projects: QuoteComparisonSite[]
  category: ContractCategory
}) {
  const labels = projects.map((project) => contractProjectKeyLabel(project.key))
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      <SummaryChip label={contractPartyLabel(partyKind)} value={partyName} />
      <SummaryChip label="Projeler" value={labels.join(', ')} />
      <SummaryChip label="Tür" value={contractCategoryLabel(category) || ''} />
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-elegant-gray-50 px-3 py-1.5 text-xs">
      <span className="font-bold uppercase tracking-[0.08em] text-elegant-gray-500">{label}</span>
      <span className="truncate font-medium text-elegant-black">{value}</span>
    </span>
  )
}

function PartyKindCard({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border px-4 py-4 text-left transition',
        active
          ? 'border-black bg-black text-white'
          : 'border-elegant-gray-200 bg-white hover:border-elegant-gray-300'
      )}
    >
      <span className={cn(
        'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
        active ? 'bg-white/10' : 'bg-elegant-gray-50 text-elegant-black'
      )}>
        {icon}
      </span>
      <span className="block text-base font-semibold">{title}</span>
      <span className={cn('mt-1 block text-sm', active ? 'text-white/70' : 'text-elegant-gray-500')}>
        {description}
      </span>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
        {label}
      </span>
      {children}
    </label>
  )
}
