import { Link } from 'react-router-dom'
import Card from './Card'

interface BookCardProps {
  id: string
  title: string
  totalWords: number
  createdAt: string
}

export default function BookCard({ id, title, totalWords, createdAt }: BookCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-white font-semibold text-lg truncate">{title}</h3>
      <p className="text-gray-400 text-sm">{totalWords.toLocaleString()} words</p>
      <p className="text-gray-600 text-xs">{new Date(createdAt).toLocaleDateString()}</p>
      <Link
        to={`/reader/${id}`}
        className="mt-auto inline-block bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg text-center transition-colors"
      >
        Read
      </Link>
    </Card>
  )
}
