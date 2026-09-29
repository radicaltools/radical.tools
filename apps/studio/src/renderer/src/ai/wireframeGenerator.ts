// Registers Studio's AI wireframe generator with MockupWireframe. The
// generator itself is loaded on first use: it pulls in every provider adapter.

import { setWireframeGenerator } from '../components/wireframeGeneration'
import { loadAISettings } from './settings'

setWireframeGenerator({
  enabled: () => loadAISettings().enabled,
  async generate(mockupId, nodes, relations, signal) {
    const { generateWireframe } = await import('./mockupWireframe')
    return generateWireframe(mockupId, nodes, relations, loadAISettings(), signal)
  },
})
