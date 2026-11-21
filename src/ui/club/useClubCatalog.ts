import { useEffect, useState } from 'react'
import type { ClubCatalog } from '../../application/club/ports'
import type { ClubManagement } from '../../application/club/service'

export function useClubCatalog(management: ClubManagement) {
  const [state, setState] = useState<{ catalog: ClubCatalog | null; failed: boolean }>({ catalog: null, failed: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const unsubscribe = management.observe(
      (catalog) => { if (active) setState({ catalog, failed: false }) },
      () => { if (active) setState({ catalog: null, failed: true }) },
    )
    return () => { active = false; unsubscribe() }
  }, [management, attempt])
  return { ...state, retry: () => { setState({ catalog: null, failed: false }); setAttempt((value) => value + 1) } }
}
