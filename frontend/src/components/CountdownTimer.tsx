import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  seconds: number
  onComplete?: () => void
}

export default function CountdownTimer({ seconds, onComplete }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    setRemaining(seconds)
    setProgress(100)
  }, [seconds])

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.()
      return
    }

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const newRemaining = Math.max(0, prev - 1)
        setProgress((newRemaining / seconds) * 100)
        return newRemaining
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [remaining, seconds, onComplete])

  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14">
        <svg className="transform -rotate-90 w-14 h-14">
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-secondary-500 transition-all duration-1000"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-900">{remaining}s</span>
        </div>
      </div>
      <div className="text-xs text-gray-600">
        <div className="font-semibold">Next action in</div>
        <div className="text-[10px] text-gray-500">{remaining}s</div>
      </div>
    </div>
  )
}

