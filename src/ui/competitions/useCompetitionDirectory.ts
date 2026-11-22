import { useEffect, useState } from 'react'
import type { CompetitionDirectory } from '../../application/competitions/ports'
import type { CompetitionManagement } from '../../application/competitions/service'

export function useCompetitionDirectory(management: CompetitionManagement) {
  const [state, setState] = useState<{ directory: CompetitionDirectory | null; failed: boolean }>({ directory: null, failed: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const unsubscribe = management.observe(
      (directory) => { if (active) setState({ directory, failed: false }) },
      () => { if (active) setState({ directory: null, failed: true }) },
    )
    return () => { active = false; unsubscribe() }
  }, [management, attempt])
  return { ...state, retry: () => { setState({ directory: null, failed: false }); setAttempt((value) => value + 1) } }
}
