/** Marka paleti. Birincil yeşil (primary) ayrı durur. */
const navy = {
  DEFAULT: "#004777",
  50: "#E8F2F8",
  100: "#D0E4F1",
  200: "#A6C9E2",
  300: "#6BA3CB",
  400: "#3B7AAD",
  500: "#005A96",
  600: "#004777",
  700: "#003A62",
  800: "#002C4A",
  900: "#001E33",
  950: "#00121F",
}

const coral = {
  DEFAULT: "#FF5E5B",
  50: "#FFF1F0",
  100: "#FFE0DE",
  200: "#FFC2BE",
  300: "#FF9B97",
  400: "#FF7A76",
  500: "#FF5E5B",
  600: "#D63A37",
  700: "#C2322F",
  800: "#9A2422",
  900: "#6E1816",
  950: "#420C0B",
}

const bordeaux = {
  DEFAULT: "#53131E",
  50: "#F8EEEE",
  100: "#F0D9DC",
  200: "#E0B3B9",
  300: "#C47D88",
  400: "#9A4454",
  500: "#53131E",
  600: "#451018",
  700: "#370D13",
  800: "#2A090E",
  900: "#1C0609",
  950: "#100305",
}

/** Açık yeşil yüzeyler nötr; dolu yeşil adımlar birincil yeşilde kalır. */
const brandGreen = {
  50: "#F6F6F6",
  100: "#ECECEC",
  200: "#DEDEDE",
  300: "#C2C2C2",
  400: "#00E676",
  500: "#00A85C",
  600: "#008F4C",
  700: "#007944",
  800: "#005C33",
  900: "#003D22",
  950: "#002414",
}

const ink = {
  50: "#FAFAFA",
  100: "#F0F0F0",
  200: "#E4E4E4",
  300: "#C8C8C8",
  400: "#8A8A8A",
  500: "#404040",
  600: "#262626",
  700: "#171717",
  800: "#0A0A0A",
  900: "#050505",
  950: "#000000",
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        'helvetica-neue': ['Akkurat', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontWeight: {
        'light': '300',
        'normal': '400',
        'medium': '500',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#00E676",
          foreground: "#0a0a0a",
          50: "#F6F6F6",
          100: "#ECECEC",
          200: "#DEDEDE",
          300: "#C2C2C2",
          400: "#33d894",
          500: "#00E676",
          600: "#00c46a",
          700: "#009f56",
          800: "#007944",
          900: "#005c33",
        },
        navy,
        coral,
        bordeaux,
        ink,
        blue: navy,
        sky: navy,
        cyan: navy,
        indigo: navy,
        teal: navy,
        red: coral,
        rose: coral,
        orange: coral,
        amber: bordeaux,
        yellow: bordeaux,
        purple: bordeaux,
        violet: bordeaux,
        fuchsia: bordeaux,
        pink: bordeaux,
        green: brandGreen,
        emerald: brandGreen,
        lime: ink,
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#00E676",
          foreground: "#0a0a0a",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        elegant: {
          black: "#0a0a0a",
          red: "#00E676",
          gray: {
            50: "#fafafa",
            100: "#f5f5f5",
            200: "#e5e5e5",
            300: "#d4d4d4",
            400: "#a3a3a3",
            500: "#737373",
            600: "#525252",
            700: "#404040",
            800: "#262626",
            900: "#171717",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        '4xl': '2rem',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}