// Studio's document persistence, as main.tsx installs it. A separate setup
// file because it must run after setup.ts has stubbed window: imports are
// evaluated before a module's own code.
import '../src/renderer/src/persistence/autosave'
import '../src/renderer/src/persistence/selection'
import '../src/renderer/src/persistence/changeFlash'
import '../src/renderer/src/persistence/followAgent'
import '../src/renderer/src/persistence/agentVersion'
