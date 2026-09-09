import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

// Storybook renders stories in its own iframe, so the fonts the app loads from index.html have
// to be requested here as well.
const fonts = document.createElement('link')
fonts.rel = 'stylesheet'
fonts.href =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap'
document.head.appendChild(fonts)

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story) => (
      <div className="bg-paper text-ink font-body p-6">
        <Story />
      </div>
    ),
  ],
}

export default preview
