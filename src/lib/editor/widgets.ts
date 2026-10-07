import { type EditorView, WidgetType } from "@codemirror/view"
import { renderMath } from "@eris/markdown"

export class Bullet extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const dot = document.createElement("span")

    dot.className = "cm-bullet"
    dot.textContent = "•"

    return dot
  }
}

export class Task extends WidgetType {
  constructor(readonly done: boolean) {
    super()
  }

  eq(other: Task) {
    return other.done === this.done
  }

  toDOM() {
    const box = document.createElement("input")

    box.type = "checkbox"
    box.className = "cm-task checkbox checkbox-xs checkbox-primary"
    box.checked = this.done

    return box
  }

  ignoreEvent() {
    return false
  }
}

export class Rule extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const line = document.createElement("span")

    line.className = "cm-rule"

    return line
  }
}

export class Formula extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
  ) {
    super()
  }

  eq(other: Formula) {
    return other.tex === this.tex && other.display === this.display
  }

  toDOM() {
    const host = document.createElement(this.display ? "div" : "span")

    host.className = this.display ? "cm-math cm-math-block" : "cm-math"

    if (this.tex.trim() === "") {
      host.classList.add("cm-math-empty")
      host.textContent = "수식 없음"
    } else {
      host.innerHTML = renderMath(this.tex, this.display)
    }

    return host
  }

  ignoreEvent() {
    return false
  }
}

export class Picture extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super()
  }

  eq(other: Picture) {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(view: EditorView) {
    const image = document.createElement("img")

    image.className = "cm-image"
    image.src = this.src
    image.alt = this.alt
    image.addEventListener("load", () => view.requestMeasure())

    return image
  }

  ignoreEvent() {
    return false
  }
}
