// Videos from the Radical Tools YouTube channel, played on the page in a dialog.
//
// A link with data-video="<id>" (and optionally data-list="<playlist id>" and
// data-index="<1-based place in it>") is a plain link to YouTube without script.
// With script, a click opens the dialog and loads the player from
// youtube-nocookie.com; closing it (Esc, ✕, a click beside it) removes the
// player, so the video stops. data-video="playlist" with data-list plays the
// whole playlist. ⌘/Ctrl/Shift-click still opens YouTube.
(() => {
  const links = document.querySelectorAll('[data-video]')
  if (!links.length) return
  let dialog, frame, heading
  const open = (link) => {
    if (!dialog) {
      dialog = document.createElement('dialog')
      dialog.className = 'video-dialog'
      dialog.innerHTML = '<div class="video-dialog-head"><span></span>'
        + '<a href="https://www.youtube.com/@Radical-Tools" target="_blank" rel="noopener">More on YouTube →</a>'
        + '<button type="button" class="video-dialog-close" aria-label="Close">✕</button></div>'
        + '<div class="video-frame"></div>'
      document.body.append(dialog)
      frame = dialog.querySelector('.video-frame')
      heading = dialog.querySelector('.video-dialog-head span')
      dialog.querySelector('.video-dialog-close').addEventListener('click', () => dialog.close())
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
      dialog.addEventListener('close', () => frame.replaceChildren())
    }
    const { video, list, index, title } = link.dataset
    const params = new URLSearchParams({ autoplay: '1', rel: '0' })
    if (list) params.set('list', list)
    if (index) params.set('index', index)
    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube-nocookie.com/embed/${video === 'playlist' ? 'videoseries' : video}?${params}`
    iframe.title = title || 'Radical.Tools video'
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    iframe.allowFullscreen = true
    heading.textContent = title || ''
    dialog.setAttribute('aria-label', title || 'Video')
    frame.replaceChildren(iframe)
    dialog.showModal()
  }
  for (const link of links) {
    link.addEventListener('click', (event) => {
      if (typeof HTMLDialogElement !== 'function' || event.metaKey || event.ctrlKey || event.shiftKey) return
      event.preventDefault()
      open(link)
    })
  }
})()
