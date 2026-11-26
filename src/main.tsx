import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './ui/App'
import { createStorageHealth, IrukaDatabase } from './infrastructure/storage/database'
import { DexieClubRepository } from './infrastructure/storage/club-repository'
import { createClubManagement } from './application/club/service'
import { DexieAthleteRepository } from './infrastructure/storage/athlete-repository'
import { createAthleteManagement } from './application/athletes/service'
import { DexieMembershipRepository } from './infrastructure/storage/membership-repository'
import { createMembershipManagement } from './application/memberships/service'
import { DexieCompetitionRepository } from './infrastructure/storage/competition-repository'
import { createCompetitionManagement } from './application/competitions/service'
import { DexieMatchRepository } from './infrastructure/storage/match-repository'
import { createMatchManagement } from './application/matches/service'
import { createLiveMatchManagement } from './application/live/service'
import { DexieLiveMatchRepository } from './infrastructure/storage/live-match-repository'
import './ui/styles.css'

const database = new IrukaDatabase()
const storageHealth = createStorageHealth(database)
const clubManagement = createClubManagement(new DexieClubRepository(database), () => crypto.randomUUID())
const membershipManagement = createMembershipManagement(new DexieMembershipRepository(database), () => crypto.randomUUID())
const competitionManagement = createCompetitionManagement(new DexieCompetitionRepository(database), () => crypto.randomUUID())
const athleteManagement = createAthleteManagement(new DexieAthleteRepository(database), () => crypto.randomUUID(), () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})
const matchManagement = createMatchManagement(new DexieMatchRepository(database), () => crypto.randomUUID())
const liveMatchManagement = createLiveMatchManagement(new DexieLiveMatchRepository(database), () => crypto.randomUUID(), () => new Date().toISOString())
const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el contenedor de IrukaData.')

// Composición: la UI recibe puertos; nunca conoce Dexie.
createRoot(container).render(
  <StrictMode>
    <HashRouter><App storageHealth={storageHealth} clubManagement={clubManagement} athleteManagement={athleteManagement} membershipManagement={membershipManagement} competitionManagement={competitionManagement} matchManagement={matchManagement} liveMatchManagement={liveMatchManagement} /></HashRouter>
  </StrictMode>,
)
