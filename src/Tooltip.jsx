import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function Tooltip({ children, content }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors text-xs font-bold ml-1"
      >
        ?
      </div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 left-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl pointer-events-none"
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          >
            {content}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

