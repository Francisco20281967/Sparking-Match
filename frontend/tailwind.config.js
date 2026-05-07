/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                heading: ['Rajdhani', 'sans-serif'],
                body: ['"Exo 2"', 'sans-serif'],
                display: ['Orbitron', 'sans-serif'],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                ki: {
                    gold: '#FBBF24',
                    goldlight: '#FDE047',
                    blue: '#06B6D4',
                    purple: '#8B5CF6',
                    red: '#EF4444',
                    green: '#10B981',
                    void: '#05030A',
                    surface: '#0E0B16',
                }
            },
            keyframes: {
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
                'aura-pulse': {
                    '0%, 100%': { boxShadow: '0 0 30px rgba(251,191,36,0.45), 0 0 60px rgba(251,191,36,0.25), inset 0 0 30px rgba(251,191,36,0.15)' },
                    '50%': { boxShadow: '0 0 60px rgba(251,191,36,0.85), 0 0 120px rgba(251,191,36,0.45), inset 0 0 50px rgba(251,191,36,0.3)' },
                },
                'ki-flow': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                'flash': {
                    '0%, 100%': { opacity: '0' },
                    '50%': { opacity: '1' },
                },
                'shake': {
                    '0%, 100%': { transform: 'translate3d(0,0,0)' },
                    '20%, 60%': { transform: 'translate3d(-4px,0,0)' },
                    '40%, 80%': { transform: 'translate3d(4px,0,0)' },
                },
                'fade-in': {
                    from: { opacity: 0, transform: 'scale(0.98) translateY(6px)' },
                    to: { opacity: 1, transform: 'scale(1) translateY(0)' },
                },
                'spin-slow': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                },
                'orbit': {
                    from: { transform: 'rotate(0deg) translateX(40px) rotate(0deg)' },
                    to: { transform: 'rotate(360deg) translateX(40px) rotate(-360deg)' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'aura-pulse': 'aura-pulse 2.4s ease-in-out infinite',
                'ki-flow': 'ki-flow 6s ease infinite',
                'flash': 'flash 0.6s ease-out',
                'shake': 'shake 0.6s ease-in-out',
                'fade-in': 'fade-in 0.35s ease-out',
                'spin-slow': 'spin-slow 12s linear infinite',
                'orbit': 'orbit 4s linear infinite',
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
};
