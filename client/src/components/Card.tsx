import { HTMLAttributes } from 'react'

export default function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-[#1a1a1a] rounded-xl p-6 shadow-lg ${className}`} {...props}>
      {children}
    </div>
  )
}
