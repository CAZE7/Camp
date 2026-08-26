import React, { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button, buttonVariants } from "./button"

describe("Button component", () => {
  it("renders correctly with default variant and size", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button.tagName.toLowerCase()).toBe("button")
    // Default variant & size classes
    expect(button).toHaveClass("bg-primary", "text-primary-foreground", "h-11", "px-4", "py-2")
  })

  it.each([
    ["default", "bg-primary text-primary-foreground hover:bg-primary/90"],
    ["destructive", "bg-destructive text-destructive-foreground hover:bg-destructive/90"],
    ["outline", "border border-rule bg-bone text-ink hover:bg-accent hover:text-ink"],
    ["secondary", "bg-secondary text-secondary-foreground hover:bg-secondary/80"],
    ["ghost", "text-ink hover:bg-accent hover:text-ink"],
    ["link", "text-primary underline-offset-4 hover:underline"],
  ] as const)("applies correct classes for variant '%s'", (variant, expectedClasses) => {
    render(<Button variant={variant}>{variant} button</Button>)
    const button = screen.getByRole("button", { name: new RegExp(`${variant} button`, "i") })
    const expectedClassList = expectedClasses.split(" ")
    expectedClassList.forEach((className) => {
      expect(button).toHaveClass(className)
    })
  })

  it.each([
    ["default", "h-11 px-4 py-2"],
    ["sm", "h-11 rounded-md px-3"],
    ["lg", "h-12 rounded-md px-8"],
    ["icon", "h-11 w-11"],
  ] as const)("applies correct classes for size '%s'", (size, expectedClasses) => {
    render(<Button size={size}>Size {size}</Button>)
    const button = screen.getByRole("button", { name: new RegExp(`size ${size}`, "i") })
    const expectedClassList = expectedClasses.split(" ")
    expectedClassList.forEach((className) => {
      expect(button).toHaveClass(className)
    })
  })

  it("merges custom className correctly", () => {
    render(<Button className="custom-class my-custom-style">Custom</Button>)
    const button = screen.getByRole("button", { name: /custom/i })
    expect(button).toHaveClass("custom-class", "my-custom-style", "bg-primary")
  })

  it("supports asChild to render custom element (e.g. anchor tag)", () => {
    render(
      <Button asChild>
        <a href="https://example.com">Link Button</a>
      </Button>
    )
    const link = screen.getByRole("link", { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link.tagName.toLowerCase()).toBe("a")
    expect(link).toHaveAttribute("href", "https://example.com")
    expect(link).toHaveClass("bg-primary", "text-primary-foreground")
  })

  it("forwards ref correctly to the button element", () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Ref test</Button>)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName.toLowerCase()).toBe("button")
  })

  it("passes additional HTML attributes", () => {
    render(
      <Button data-testid="custom-button" disabled aria-label="Custom Label">
        Disabled
      </Button>
    )
    const button = screen.getByTestId("custom-button")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-label", "Custom Label")
  })
})

describe("buttonVariants function helper", () => {
  it("returns default variant and size classes when called with no options", () => {
    const classes = buttonVariants()
    expect(classes).toContain("bg-primary")
    expect(classes).toContain("h-11")
  })

  it("returns specified variant and size classes", () => {
    const classes = buttonVariants({ variant: "destructive", size: "lg" })
    expect(classes).toContain("bg-destructive")
    expect(classes).toContain("h-12")
  })
})
