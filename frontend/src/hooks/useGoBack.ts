import { useNavigate } from 'react-router-dom'

/**
 * Returns a function that navigates back within the app's history stack.
 * Uses React Router's internal history index (window.history.state.idx) rather
 * than window.history.length, which is unreliable in PWAs (it includes history
 * from before the app was opened).
 *
 * If there's no app history to go back to, navigates to the fallback path.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }
}
