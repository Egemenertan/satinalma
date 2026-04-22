/**
 * Auth Modülü - Public API
 */

export {
  DEFAULT_MICROSOFT_USER_ROLE,
  getInitialRole,
  getInitialSiteIds,
  getPostLoginRedirectPath,
  canAccessDashboard,
} from './domain'

export {
  ensureUserProfile,
  getUserProfile,
  type ProfileEnsureResult,
} from './profile'
