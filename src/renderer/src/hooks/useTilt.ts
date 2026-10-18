import { useState } from 'react'
import type React from 'react'

export function useTilt(maxDegrees = 35) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const isResting = tilt.x === 0 && tilt.y === 0

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    setTilt({ x: dy * -maxDegrees, y: dx * maxDegrees })
  }

  const onMouseLeave = () => setTilt({ x: 0, y: 0 })

  const tiltTransform = `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
  const tiltTransition = isResting
    ? 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : 'transform 0.06s linear'

  return { tilt, onMouseMove, onMouseLeave, tiltTransform, tiltTransition, isResting }
}
