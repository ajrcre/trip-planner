import { wrapSelection, insertLink, applyListPrefix } from "../markdown-toolbar"

describe("wrapSelection", () => {
  it("wraps a selected substring with prefix and suffix", () => {
    const result = wrapSelection("hello world", 6, 11, "**", "**")
    expect(result.text).toBe("hello **world**")
    expect(result.selectionStart).toBe(8)
    expect(result.selectionEnd).toBe(13)
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("world")
  })

  it("inserts empty markers at the cursor when nothing is selected", () => {
    const result = wrapSelection("hello ", 6, 6, "*", "*")
    expect(result.text).toBe("hello **")
    expect(result.selectionStart).toBe(7)
    expect(result.selectionEnd).toBe(7)
  })

  it("supports different prefix and suffix (underline tags)", () => {
    const result = wrapSelection("hello world", 6, 11, "<u>", "</u>")
    expect(result.text).toBe("hello <u>world</u>")
  })
})

describe("insertLink", () => {
  it("wraps a selected URL as a link and selects the placeholder label", () => {
    const result = insertLink("visit https://example.com now", 6, 25)
    expect(result.text).toBe("visit [קישור](https://example.com) now")
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("קישור")
  })

  it("wraps selected text as a link label with an empty URL, cursor inside the parens", () => {
    const result = insertLink("check this out", 6, 10)
    expect(result.text).toBe("check [this]() out")
    expect(result.selectionStart).toBe(result.selectionEnd)
    expect(result.text.slice(0, result.selectionStart).endsWith("(")).toBe(true)
  })

  it("inserts empty brackets when nothing is selected", () => {
    const result = insertLink("hello ", 6, 6)
    expect(result.text).toBe("hello []()")
  })
})

describe("applyListPrefix", () => {
  it("adds bullet prefixes to every line touched by the selection", () => {
    const value = "one\ntwo\nthree"
    const result = applyListPrefix(value, 0, value.length, false)
    expect(result.text).toBe("- one\n- two\n- three")
  })

  it("adds incrementing numbers for an ordered list", () => {
    const value = "one\ntwo\nthree"
    const result = applyListPrefix(value, 0, value.length, true)
    expect(result.text).toBe("1. one\n2. two\n3. three")
  })

  it("only affects lines touched by a partial selection", () => {
    const value = "one\ntwo\nthree"
    const result = applyListPrefix(value, 4, 7, false)
    expect(result.text).toBe("one\n- two\nthree")
  })
})
