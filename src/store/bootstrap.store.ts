import { create } from 'zustand'
import type { BootstrapNeeds } from '../types'

interface BootstrapState {
  needs: BootstrapNeeds
  wizardOpen: boolean
  setNeeds: (needs: BootstrapNeeds) => void
  openWizard: () => void
  closeWizard: () => void
}

export const useBootstrapStore = create<BootstrapState>((set) => ({
  needs: {},
  wizardOpen: false,
  setNeeds: (needs) => set({ needs, wizardOpen: Object.values(needs).some(Boolean) }),
  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
}))
