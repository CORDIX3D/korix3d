import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090909',
        foreground: '#F5F5F5',
        card: '#151515',
        'card-foreground': '#F5F5F5',
        popover: '#151515',
        'popover-foreground': '#F5F5F5',
        primary: {
          DEFAULT: '#FF6A00',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#1a1a1a',
          foreground: '#F5F5F5',
        },
        muted: {
          DEFAULT: '#1a1a1a',
          foreground: '#737373',
        },
        accent: {
          DEFAULT: '#252525',
          foreground: '#F5F5F5',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#FFFFFF',
        },
        border: '#252525',
        input: '#252525',
        ring: '#FF6A00',
        success: '#22c55e',
        warning: '#eab308',
        info: '#3b82f6',
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'fade-down': 'fade-down 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'glow': {
          from: { boxShadow: '0 0 20px rgba(255, 106, 0, 0.2)' },
          to: { boxShadow: '0 0 40px rgba(255, 106, 0, 0.4)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #FF6A00 0%, #FF8C00 50%, #FFA500 100%)',
        'gradient-dark': 'linear-gradient(180deg, #090909 0%, #151515 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 106, 0, 0.3)',
        'glow-lg': '0 0 40px rgba(255, 106, 0, 0.4)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.5)',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
