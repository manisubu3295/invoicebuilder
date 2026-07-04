/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
  // StatusBadge.vue and a few list views build the class name dynamically
  // (`badge-${status}`), so Tailwind's content scanner can never see these
  // literal strings and was purging all of them from the build — every
  // status badge in the app was rendering as unstyled plain text.
  safelist: [
    'badge-draft', 'badge-sent', 'badge-paid', 'badge-overdue', 'badge-cancelled',
    'badge-pending', 'badge-invoiced', 'badge-in_transit', 'badge-delivered',
    'badge-accepted', 'badge-rejected', 'badge-converted', 'badge-active',
    'badge-inactive', 'badge-admin', 'badge-staff', 'badge-driver',
  ],
}
