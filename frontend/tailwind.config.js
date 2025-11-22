/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                forest: {
                    dark: 'var(--color-bg)',
                    DEFAULT: 'var(--color-bg-secondary)',
                    light: 'var(--color-bg-secondary)', // Mapping to secondary for now
                },
                earth: {
                    tan: 'var(--color-accent)',
                    light: 'var(--color-accent)', // Mapping to accent
                    dark: 'var(--color-text-muted)',
                    cream: 'var(--color-text)',
                },
                status: {
                    success: '#5A7A5C',
                    warning: '#B89F7C',
                    error: '#9A6F5C',
                    info: '#7A8A7C',
                }
            },
            fontFamily: {
                mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
            },
            backgroundImage: {
                'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")",
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
