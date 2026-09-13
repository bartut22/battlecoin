import { Container, ObservablePoint, Sprite, Text } from 'pixi.js'

// Share the dashboard's cent image with canvas labels, including hover prices.
export class PixelText extends Container {
  constructor(value, size, color, centTexture) {
    super()
    this.textStyle = { fontFamily: 'VT323', fontSize: size + 8, fill: color, stroke: { color: '#302718', width: 2 } }
    this.centTexture = centTexture
    this.content = new Container()
    this.addChild(this.content)
    this.anchor = new ObservablePoint({ _onUpdate: () => this.align() })
    this.text = value
  }
  get text() { return this.value }
  set text(value) {
    value = String(value)
    if (this.value === value) return
    this.value = value
    for (const child of this.content.removeChildren()) child.destroy({ children: true })
    let x = 0
    const height = new Text({ text: '0', style: this.textStyle })
    this.lineHeight = height.height
    height.destroy()
    for (const [index, part] of value.split('\u00a2').entries()) {
      if (index > 0) {
        const icon = new Sprite(this.centTexture)
        icon.height = this.textStyle.fontSize * .64
        icon.width = icon.height * 5 / 9
        icon.position.set(x + 1, (this.lineHeight - icon.height) / 2)
        icon.tint = this.textStyle.fill
        this.content.addChild(icon)
        x += icon.width + 3
      }
      if (part) {
        const label = new Text({ text: part, roundPixels: true, style: this.textStyle })
        label.x = x
        this.content.addChild(label)
        x += label.width
      }
    }
    this.lineWidth = x
    this.align()
  }
  align() {
    this.content.position.set(-this.anchor.x * this.lineWidth, -this.anchor.y * this.lineHeight)
  }
}
