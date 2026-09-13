import { Fragment } from 'react'

export function CentIcon() {
  return <span className="cent-unit" role="img" aria-label="cents"><span className="cent-accessible">{'\u00a2'}</span></span>
}

export function CentMessage({ text }) {
  return String(text).split('\u00a2').map((part, index) => <Fragment key={index}>{index > 0 && <CentIcon/>}{part}</Fragment>)
}
