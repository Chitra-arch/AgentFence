export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: {
    ink: '#090907', panel: '#14130f', brown: '#6C5636', amber: '#B99D73',
    fg: '#EDE5D8', muted: '#A39580', danger: '#D17A62' },
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'monospace'] } } },
}
