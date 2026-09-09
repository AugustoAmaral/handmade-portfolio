import * as a11yAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as previewAnnotations from './preview'

// Gives every story-as-test the decorators, parameters and globals from preview.tsx, plus the
// a11y addon's own annotations. Storybook's vitest addon would inject these itself, but it skips
// that as soon as a setup file calls setProjectAnnotations — so anything listed in main.ts that
// ships a `/preview` entry point has to be composed here by hand. Order matters: the project's
// own preview goes last so it wins.
setProjectAnnotations([a11yAnnotations, previewAnnotations])
