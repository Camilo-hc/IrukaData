import { useEffect, useState } from 'react'
import type { AthleteDirectory } from '../../application/athletes/ports'
import type { AthleteManagement } from '../../application/athletes/service'

export function useAthleteDirectory(management: AthleteManagement) {
  const [state, setState] = useState<{ directory: AthleteDirectory | null; failed: boolean }>({ directory: null, failed: false })
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
