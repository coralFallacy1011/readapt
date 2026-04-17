import { Types } from 'mongoose'
import {
  shouldUseTestORP,
  getORPIndexWithTesting,
  calculateReadingVelocity
} from '../services/ml/orpOptimizer'
import { IReadingSession } from '../models/ReadingSession'

describe('ORP Optimizer Service', () => {
  describe('Task 4.1: A/B Testing ORP Selection', () => {
    describe('shouldUseTestORP', () => {
      it('should return boolean', () => {
        const result = shouldUseTestORP(0)
        expect(typeof result).toBe('boolean')
      })

      it('should return true approximately 20% of the time', () => {
        const trials = 10000
        let trueCount = 0
        
        for (let i = 0; i < trials; i++) {
          if (shouldUseTestORP(i)) {
            trueCount++
          }
        }
        
        const percentage = (trueCount / trials) * 100
        // Allow 5% margin of error
        expect(percentage).toBeGreaterThan(15)
        expect(percentage).toBeLessThan(25)
      })
    })

    describe('getORPIndexWithTesting', () => {
      it('should return valid ORP index within word bounds', () => {
        const word = 'testing'
        const index = getORPIndexWithTesting(word, 0)
        
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(word.length)
      })

      it('should return standard ORP for short words', () => {
        const word = 'cat'
        const results = []
        
        for (let i = 0; i < 100; i++) {
          results.push(getORPIndexWithTesting(word, i))
        }
        
        // All results should be valid indices
        results.forEach(idx => {
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(word.length)
        })
      })

      it('should handle single character words', () => {
        const word = 'I'
        const index = getORPIndexWithTesting(word, 0)
        expect(index).toBe(0)
      })
    })
  })

  describe('Task 4.4: Reading Velocity Calculation', () => {
    it('should calculate velocity correctly with no pauses', () => {
      const session = {
        lastWordIndex: 100,
        timeSpent: 20,  // 20 seconds
        pauseEvents: []
      } as Partial<IReadingSession> as IReadingSession

      const velocity = calculateReadingVelocity(session)
      
      // 100 words / 20 seconds * (1 - 0) = 5 words/second = 300 WPM
      expect(velocity).toBe(5)
    })

    it('should calculate velocity correctly with pauses', () => {
      const session = {
        lastWordIndex: 100,
        timeSpent: 20,
        pauseEvents: [
          { wordIndex: 10, duration: 3000 },  // >2s
          { wordIndex: 50, duration: 2500 },  // >2s
          { wordIndex: 80, duration: 1000 }   // <2s, doesn't count
        ]
      } as Partial<IReadingSession> as IReadingSession

      const velocity = calculateReadingVelocity(session)
      
      // pause_rate = 2/100 = 0.02
      // velocity = (100/20) * (1 - 0.02) = 5 * 0.98 = 4.9
      expect(velocity).toBeCloseTo(4.9, 2)
    })

    it('should return 0 for zero time spent', () => {
      const session = {
        lastWordIndex: 100,
        timeSpent: 0,
        pauseEvents: []
      } as Partial<IReadingSession> as IReadingSession

      const velocity = calculateReadingVelocity(session)
      expect(velocity).toBe(0)
    })

    it('should return 0 for zero words read', () => {
      const session = {
        lastWordIndex: 0,
        timeSpent: 20,
        pauseEvents: []
      } as Partial<IReadingSession> as IReadingSession

      const velocity = calculateReadingVelocity(session)
      expect(velocity).toBe(0)
    })
  })
})
