import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite 8 usa o Rolldown como bundler. Para separar bibliotecas pesadas em
// vendor chunks próprios (melhor cache + download paralelo, e some o aviso de
// chunk > 500 kB) usamos a API nativa `codeSplitting.groups` do Rolldown.
// Regex com `[\\/]` (e não `/`) para casar o separador de path no Windows.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React + ReactDOM + scheduler no mesmo chunk (dependem entre si).
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'vendor-router',
              test: /node_modules[\\/]react-router(-dom)?[\\/]/,
              priority: 35,
            },
            {
              name: 'vendor-framer-motion',
              test: /node_modules[\\/]framer-motion[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 30,
            },
            // recharts arrasta d3-*, victory-vendor etc. — junta o gráfico todo.
            {
              name: 'vendor-recharts',
              test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|fast-equals)[\\/]/,
              priority: 30,
            },
          ],
        },
      },
    },
  },
})
