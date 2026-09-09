import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stat } from './Stat'

const meta = { component: Stat, title: 'Primitives/Stat' } satisfies Meta<typeof Stat>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { value: '4', label: 'peças no catálogo' } }
