import { useState, useCallback, useEffect } from 'react'
import ChartExpandButton from './ChartExpandButton'
import LandscapeChartOverlay from './LandscapeChartOverlay'

interface Props {
  title: string
  subtitle?: string
  /** Render function receives isFullScreen flag so charts can adjust height */
  children: (isFullScreen: boolean) => React.ReactNode
  /** Hide expand button when there's no data to show */
  hasData?: boolean
}

export default function FullScreenReady({ title, subtitle, children, hasData = true }: Props) {
  const [expanded, setExpanded] = useState(false)

  const handleExpand = useCallback(() => setExpanded(true), [])
  const handleClose = useCallback(() => setExpanded(false), [])

  // Close overlay if data disappears while expanded
  useEffect(() => {
    if (!hasData && expanded) setExpanded(false)
  }, [hasData, expanded])

  return (
    <div className="relative">
      <ChartExpandButton onClick={handleExpand} visible={hasData} />
      {children(false)}
      {expanded && (
        <LandscapeChartOverlay title={title} subtitle={subtitle} onClose={handleClose}>
          <div className="h-full flex flex-col">
            {children(true)}
          </div>
        </LandscapeChartOverlay>
      )}
    </div>
  )
}
