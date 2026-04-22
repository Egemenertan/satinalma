export { useTeams, type UseTeamsResult } from './use-teams'
export {
  initializeTeams,
  isInTeamsEnvironment,
  isInIframe,
  isInOfficeEnvironment,
  getTeamsContext,
  isTeamsInitialized,
  teamsAuthenticate,
  teamsNotifyAuthSuccess,
  teamsNotifyAuthFailure,
  getTeamsSSOToken,
  popupAuthenticate,
  type TeamsContext,
  type TeamsAuthTokenPayload,
} from './teams-context'
