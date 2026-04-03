import { getORPIndex } from '../utils/orp'

interface WordDisplayProps {
  word: string
}

const ORP_OFFSET = 200 // px from left edge of container where ORP letter sits
const CONTAINER_WIDTH = 600 // px

export default function WordDisplay({ word }: WordDisplayProps) {
  if (!word) return null

  const orpIdx = getORPIndex(word.length)
  const before = word.slice(0, orpIdx)
  const orp = word[orpIdx]
  const after = word.slice(orpIdx + 1)

  return (
    <div
      style={{
        position: 'relative',
        width: `${CONTAINER_WIDTH}px`,
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'monospace',
        fontSize: '3rem',
        fontWeight: 'bold',
        userSelect: 'none'
      }}
    >
      {/* Before ORP: right-aligned up to ORP_OFFSET */}
      <span
        style={{
          position: 'absolute',
          right: `${CONTAINER_WIDTH - ORP_OFFSET}px`,
          color: '#e5e5e5',
          whiteSpace: 'nowrap'
        }}
      >
        {before}
      </span>

      {/* ORP letter: fixed at ORP_OFFSET */}
      <span
        style={{
          position: 'absolute',
          left: `${ORP_OFFSET}px`,
          color: '#f97316', // orange-500
          lineHeight: 1
        }}
      >
        {orp}
      </span>

      {/* After ORP: starts just after ORP_OFFSET + one char width */}
      <span
        style={{
          position: 'absolute',
          left: `${ORP_OFFSET + 30}px`, // ~1 char width at 3rem monospace
          color: '#e5e5e5',
          whiteSpace: 'nowrap'
        }}
      >
        {after}
      </span>
    </div>
  )
}
