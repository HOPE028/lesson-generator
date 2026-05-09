import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-[#f6f3ec]",
    "bg-[#fbfaf6]",
    {
      pattern:
        /^(m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl)-(0|1|2|3|4|5|6|7|8|9|10|12|14|16|20|24|28|32)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern: /^(space-y|space-x|gap|gap-x|gap-y)-(1|2|3|4|5|6|8|10|12)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern: /^(grid-cols|col-span)-(1|2|3|4)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern: /^(max-w)-(2xl|3xl|4xl|5xl|6xl|7xl)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern:
        /^(text)-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern:
        /^(leading)-(5|6|7|8|9|10|none|tight|snug|normal|relaxed|loose)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern:
        /^(rounded|rounded-md|rounded-lg|rounded-xl|rounded-2xl|rounded-full)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern: /^(border|border-2|border-t|border-l|border-black\/10|border-black\/20|border-dashed)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern:
        /^(bg|text|border)-(white|black|neutral|blue|emerald|red|amber|purple|yellow|green|slate|gray)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern: /^text-black(\/(50|60|70|75|80))?$/,
      variants: ["sm", "md", "lg"],
    },
    {
      pattern: /^(bg-white|shadow-sm|shadow-md|font-medium|font-semibold|font-bold|uppercase|tracking-wide|tracking-tight|overflow-hidden|inline-flex|flex|grid|items-start|items-center|justify-between|w-full|min-h-screen)$/,
      variants: ["sm", "md", "lg"],
    },
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
