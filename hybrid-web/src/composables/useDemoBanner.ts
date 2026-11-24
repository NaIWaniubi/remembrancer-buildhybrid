// Demo banner helper for screenshots / recorded demos.
//
// The app renders a caption card when the URL carries ?demo=<label>&caption=<text>
// and optionally &banner=fixed to pin it to the viewport bottom for in-page shots.
// Example: /dashboard?demo=Dashboard&caption=Guest mode runs the whole chain offline&banner=fixed
//
// This is presentation-only — it never changes application behavior, and it is
// inert when the parameters are absent, so real users never see it.

export interface DemoBanner {
  visible: boolean
  label: string
  caption: string
  fixed: boolean
}

function readDemoParams(): Omit<DemoBanner, 'visible'> {
  const params = new URLSearchParams(window.location.search)
  const label = params.get('demo')?.trim() ?? ''
  const caption = params.get('caption')?.trim() ?? ''
  const bannerParam = params.get('banner')?.trim().toLowerCase() ?? ''
  return { label, caption, fixed: bannerParam === 'fixed' }
}

const initial = readDemoParams()

export function useDemoBanner(): DemoBanner {
  return {
    visible: initial.label !== '' || initial.caption !== '',
    label: initial.label,
    caption: initial.caption,
    fixed: initial.fixed
  }
}