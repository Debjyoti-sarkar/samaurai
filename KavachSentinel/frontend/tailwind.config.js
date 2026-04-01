/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: '#0f172a',
                darker: '#020617',
                primary: '#10b981',
                danger: '#ef4444',
            }
        },
    },
    plugins: [],
}
