export {
  formatNumberWithDots,
  parseNumberFromDots,
  parseToNumber,
  formatCurrency,
} from './numberFormatting'

export {
  calculateSubtotals,
  calculateSingleSubtotal,
  calculateGrandTotal,
  validateInvoiceCurrencies,
  formatSubtotals,
  type SubtotalsByCurrency,
} from './invoiceCalculations'

export {
  formatShortDocumentNumber,
  clusterOrdersByNumber,
  groupOrdersByRequest,
  sortGroupedOrders,
  getOrderStatusBadgeClass,
  getOrderStatusText,
  filterOrdersByStatus,
  calculateOrderStats,
} from './orderUtils'

export {
  normalizeSearchTerm,
  splitSearchTerms,
  createSearchPattern,
  createMultiWordPattern,
} from './searchUtils'

export { buildOrderAnalyticsSnapshot, sparkHeightsFromCounts } from './orderAnalytics'



