// Unified Design System for KrypticTrack
// This ensures consistent styling across all components

export const designSystem = {
  // Colors
  colors: {
    background: {
      primary: 'bg-gray-900',
      secondary: 'bg-gray-800',
      card: 'bg-gray-800/50',
      cardHover: 'bg-gray-800/70',
    },
    text: {
      primary: 'text-gray-100',
      secondary: 'text-gray-300',
      tertiary: 'text-gray-400',
      muted: 'text-gray-500',
    },
    border: {
      primary: 'border-gray-700',
      secondary: 'border-gray-600',
      hover: 'border-gray-600',
    },
    accent: {
      primary: '#d4a574',
      secondary: '#a31d1d',
    },
  },
  
  // Card Styles
  card: {
    base: 'bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg',
    hover: 'hover:bg-gray-800/70 transition-all duration-200',
    padding: 'p-6',
  },
  
  // Input Styles
  input: {
    base: 'w-full px-4 py-3 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-xl focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent placeholder:text-gray-500',
    select: 'w-full px-4 py-2 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-lg focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent',
  },
  
  // Button Styles
  button: {
    primary: 'px-6 py-3 bg-[#a31d1d] text-white rounded-xl font-semibold hover:bg-[#7a1515] transition-all flex items-center gap-2',
    secondary: 'px-6 py-3 bg-gray-700 text-gray-200 rounded-xl font-semibold hover:bg-gray-600 transition-all',
    accent: 'px-6 py-3 bg-[#d4a574] text-white rounded-xl font-semibold hover:bg-[#b8935f] transition-all',
  },
  
  // Page Header
  pageHeader: {
    container: 'mb-8 pb-6 border-b border-gray-700',
    title: 'text-4xl font-bold text-gray-100 tracking-tight mb-2',
    subtitle: 'text-lg text-gray-400 max-w-2xl leading-relaxed',
  },
  
  // Table Styles
  table: {
    container: 'bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg overflow-hidden',
    header: 'px-6 py-4 border-b border-gray-700 bg-gray-800/50',
    headerText: 'text-lg font-bold text-gray-100',
    row: 'hover:bg-gray-700/50 transition-colors',
    cell: 'px-6 py-4 text-sm text-gray-300',
    headerCell: 'px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider',
  },
}


