// Registers Studio's AI wireframe generator with MockupWireframe. The
// generator itself is loaded on first use: it pulls in every provider adapter.

import { setWireframeGenerator } from '@radical/ui/components/wireframeGeneration'
import { aiReady, loadAISettings } from './settings'

setWireframeGenerator({
  enabled: () => aiReady(loadAISettings()),
  async generate(mockupId, nodes, relations, signal) {
    const { generateWireframe } = await import('./mockupWireframe')
    return generateWireframe(mockupId, nodes, relations, loadAISettings(), signal)
  },
})
