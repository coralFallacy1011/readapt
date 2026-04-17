import { useState } from 'react'

interface Question {
  question: string
  options: string[]
  correctIndex: number
  category: string
  explanation: string
}

interface QuizModalProps {
  isOpen: boolean
  quiz: {
    _id: string
    questions: Question[]
  } | null
  onSubmit: (answers: number[]) => Promise<{
    score: number
    correctAnswers: number[]
    speedAdjustmentFactor: number
  }>
  onClose: () => void
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

interface ResultState {
  score: number
  correctAnswers: number[]
  speedAdjustmentFactor: number
}

export default function QuizModal({ isOpen, quiz, onSubmit, onClose }: QuizModalProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<ResultState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen || !quiz) return null

  const questions = quiz.questions
  const allAnswered = questions.every((_, i) => answers[i] !== undefined)

  async function handleSubmit() {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    try {
      const answerArray = questions.map((_, i) => answers[i])
      const res = await onSubmit(answerArray)
      setResult(res)
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setAnswers({})
    setResult(null)
    onClose()
  }

  const scorePct = result ? Math.round(result.score * 100) : 0
  const speedMsg =
    result && result.speedAdjustmentFactor !== 1
      ? result.speedAdjustmentFactor < 1
        ? `Consider slowing down — your comprehension score suggests a lower speed may help.`
        : `Great job! You may be ready to increase your reading speed.`
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white text-lg font-bold">Comprehension Quiz</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {!result ? (
            questions.map((q, qi) => (
              <div key={qi}>
                <p className="text-white text-sm font-semibold mb-3">
                  <span className="text-orange-500 mr-1">{qi + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3
                          ${selected
                            ? 'bg-orange-500/20 border border-orange-500 text-orange-300'
                            : 'bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500'
                          }`}
                      >
                        <span className={`font-bold text-xs ${selected ? 'text-orange-400' : 'text-gray-500'}`}>
                          {OPTION_LABELS[oi]}
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <div>
              {/* Score summary */}
              <div className="bg-gray-800 rounded-lg p-4 mb-5 text-center">
                <p className="text-gray-400 text-sm mb-1">Your Score</p>
                <p className={`text-4xl font-bold ${scorePct >= 80 ? 'text-green-400' : scorePct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {scorePct}%
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {result.correctAnswers.length} / {questions.length} correct
                </p>
              </div>

              {speedMsg && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-5 text-orange-300 text-sm">
                  {speedMsg}
                </div>
              )}

              {/* Per-question breakdown */}
              <div className="space-y-4">
                {questions.map((q, qi) => {
                  const userAnswer = answers[qi]
                  const correct = result.correctAnswers[qi] ?? q.correctIndex
                  const isCorrect = userAnswer === correct
                  return (
                    <div key={qi} className={`rounded-lg p-4 border ${isCorrect ? 'border-green-700 bg-green-900/20' : 'border-red-700 bg-red-900/20'}`}>
                      <p className="text-white text-sm font-semibold mb-2">
                        <span className="mr-1">{isCorrect ? '✅' : '❌'}</span>
                        {q.question}
                      </p>
                      <p className="text-gray-400 text-xs mb-1">
                        Your answer: <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>{q.options[userAnswer] ?? '—'}</span>
                      </p>
                      {!isCorrect && (
                        <p className="text-gray-400 text-xs mb-1">
                          Correct: <span className="text-green-400">{q.options[correct]}</span>
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-gray-500 text-xs mt-1 italic">{q.explanation}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 flex gap-3">
          {!result ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="flex-1 px-4 py-2 rounded-lg font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
