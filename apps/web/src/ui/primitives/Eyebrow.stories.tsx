import type { Meta, StoryObj } from '@storybook/react-vite'
import { Eyebrow } from './Eyebrow'

const meta = { component: Eyebrow, title: 'Primitives/Eyebrow' } satisfies Meta<typeof Eyebrow>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: 'O catálogo inteiro' } }
