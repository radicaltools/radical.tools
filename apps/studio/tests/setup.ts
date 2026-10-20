// The shared window / requestAnimationFrame stubs the diagram store needs under node.
import '@radical/ui/testing/setup'

// Window events (pagehide), for persistence to listen to and tests to send.
if (typeof window.addEventListener !== 'function') {
  const events = new EventTarget()
  window.addEventListener = events.addEventListener.bind(events) as typeof window.addEventListener
  window.removeEventListener = events.removeEventListener.bind(events) as typeof window.removeEventListener
  window.dispatchEvent = events.dispatchEvent.bind(events)
}
