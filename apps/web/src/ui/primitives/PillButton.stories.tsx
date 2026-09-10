import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { PillButton } from './PillButton'

const meta = { component: PillButton, title: 'Primitives/PillButton', args: { onClick: fn() } } satisfies Meta<typeof PillButton>
export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
  args: { children: 'Colocar na sacola' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Colocar na sacola' }))
    await expect(args.onClick).toHaveBeenCalledTimes(1)
  },
}

export const Outline: Story = { args: { children: 'Cancelar', variant: 'outline' } }

// The `block` size exists because a full-width CTA cannot be spelled at the call site: `px-0` and
// `px-7` carry the same specificity, so which one wins is decided by the order Tailwind emitted
// them in and not by the class attribute. Measured against its container, because a `w-full` that
// compiles to nothing leaves the pill at its intrinsic width and nothing else in the suite looks.
export const Block: Story = {
  args: { children: 'Ir para o pagamento', size: 'block' },
  render: (args) => (
    <div className="w-[420px]">
      <PillButton {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Ir para o pagamento' })
    await expect(button.getBoundingClientRect().width).toBe(420)
  },
}

export const AsLink: Story = {
  args: { children: 'Ver o catálogo', href: '/' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute('href', '/')
  },
}

export const Disabled: Story = {
  args: { children: 'Esgotado', disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Esgotado' })).toBeDisabled()
  },
}

// The story whose absence let a real defect ship green. `href` + `disabled` was never rendered by
// any story, so axe never saw it and no play exercised it: the first implementation kept a real
// `<a href>` and only added `pointer-events-none`, which stops the mouse and nothing else — Tab
// reached it and Enter navigated. Everything below is about ONE property: disabled means inert.
export const DisabledLink: Story = {
  args: { children: 'Esgotado', href: '/', disabled: true },
  play: async ({ canvas, args }) => {
    const control = canvas.getByText('Esgotado')

    // Unreachable by keyboard...
    await userEvent.tab()
    await expect(control).not.toHaveFocus()

    // ...so it cannot be activated...
    await userEvent.keyboard('{Enter}')
    await expect(args.onClick).not.toHaveBeenCalled()

    // ...and it does not advertise itself as a link it refuses to behave like.
    await expect(canvas.queryByRole('link')).toBeNull()
    await expect(control).toBeDisabled()
  },
}
